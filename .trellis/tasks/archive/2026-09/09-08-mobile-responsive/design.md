# 技术设计：网站移动端适配

## 总体策略

单一代码库，按断点分流：`< 768px` 为移动端形态（复用既有 `useIsMobile()` hook，`web/src/hooks/use-mobile.ts`），`≥ 768px` 保持现状。不引入新依赖；导航与触屏检测均基于现有 shadcn/Radix 设施。

## 1. 导航架构（Shell 改造）

现状：`Shell.tsx` 用 `SidebarProvider` + `Sidebar`（shadcn），移动端表现为 Sheet 抽屉（`ui/sidebar.tsx` 内部 `isMobile` 分支）。

改造：

- 桌面（≥768px）：保持现有 Sidebar 结构不动，`Shell` 组件树原样。
- 移动（<768px）：不渲染 `Sidebar/Sheet`，改为：
  - `SidebarInset` 区域保持（作为页面内容容器），顶部加一个移动端 header bar：左侧页面标题，右侧「设置」图标按钮（lucide `Settings`）。
  - 底部固定 Tab 栏（`fixed bottom-0 inset-x-0 z-40`，`md:hidden`），5 个 Tab（计时/统计/目标/分类/标签），复用 `ITEMS` 数组与 `PageId` 类型、现有 i18n key 与图标；激活态用 `text-primary`。Tab 点击切换页面。
  - 底部 Tab 栏为安全区留白：`pb-[env(safe-area-inset-bottom)]`。
  - `SidebarInset` 内容底部加 padding（`pb-20 md:pb-0` 之类）避免内容被 Tab 栏遮挡。
- 组件归属：新建 `web/src/components/MobileTabBar.tsx` + 移动端 header 逻辑内联在 `Shell.tsx`（或拆 `MobileHeader.tsx`，实现时看体量）。
- `elapsedSeconds` 徽标逻辑只在 sidebar 存在（桌面）；移动端如计时运行中可在 Tab 图标上加小圆点提示（可选增强，非必须）。

## 2. 时间线（Timeline）

### 2.1 Week 视图横向滚动

- 外层滚动容器（`Timeline.tsx` 中 `overflow-auto` 的 div）已存在；week 模式内容行（header 行 + 列行）当前 `min-w-full`，7 列 `min-w-[180px]` 会把容器撑宽并触发滚动——预期行为，但需验证：
  - header 行与 7 列行必须宽度一致：把 week 内容包进一个 `min-w-max`（或固定 `w-max`）的纵排容器，两行共享同一宽度，保证表头与列不错位。
  - 共享 ruler（`.timeline-ruler--static`，flex 子项）随内容一起滚动。
- 触屏滚动顺滑：滚动容器加 `-webkit-overflow-scrolling`（现代浏览器默认 momentum，一般无需）与 `overscroll-behavior-x: contain` 防止带动页面。

### 2.2 触屏禁用拖拽创建

- 拖拽 handler 在 `DayColumn` 内（`Timeline.tsx:178-235`，`onPointerDown/Move/Up` 绑定在 track 上）。
- 方案：`DayColumn` 内用 `useIsMobile()`，`onDragCreate` prop 在触屏/窄屏时传 `undefined`（或在 handler 首行短路）。推荐在父组件 `Timeline` 给 `DayColumn` 传 `onDragCreate={isMobile ? undefined : handleDragCreate(...)}`，`DayColumn` 现有的 `if (!onDragCreate) return` 守卫自然生效，且不绑定事件。
- 备选（若想按能力而非宽度判断）：`window.matchMedia("(pointer: coarse)")`。为与全站断点策略一致，用 `useIsMobile()`（宽度）即可；窄屏窗口 + 鼠标的场景丢失拖拽，可接受（还有 gap 点击）。
- gap 插槽（`.timeline-slot`）点击创建流程已有，无需改动。

### 2.3 窄屏可读性

- `.timeline-ruler` 56px 宽、`padding-left: 10px`：在 `styles.css` 加 `@media (max-width: 767px)` 下调（如 44px、padding 6px、font-size 11px）。
- 色块内文字（13px/12px）保持，验证不换行溢出即可（`overflow: hidden` + ellipsis 已有）。
- Timeline 顶部工具条（Tabs 切换 + 缩放按钮 + DateNav + 总时长）在 375px：允许 flex-wrap 或缩小 gap；`DateNav` 本身是按钮组，验证宽度。

## 3. 布局与组件适配

### 3.1 触屏命中区

- `HierarchicalListCard` 行菜单按钮：外层按钮从 `size-6` 扩到触屏友好的 hit area——用伪元素扩 hit（`after:absolute after:-inset-2`）或直接 `size-8`（视觉密度权衡，实现时定）。原则：不破坏桌面视觉密度，扩的是命中区。
- `size="icon-xs"` 的缩放按钮等：保持视觉，扩 hit area（CSS `::after` 扩展），或全局给 `.timeline-track` 等加 `touch-action: pan-y`。

### 3.2 表格页（Goals / Tokens）

- 方案：外层容器 `overflow-x-auto` 横向滚动（与 week 视图策略一致，改动最小）。
- GoalsPage `TableHead className="w-[240px]"` 等固定列宽照旧，容器可滚即可。

### 3.3 表单（EntryEditor / GoalEditorDialog / DateTimePicker）

- Popover 宽度：`PopoverContent` 默认 `w-72`，窄屏用 `max-w-[calc(100vw-2rem)]` 约束（shadcn dialog 已有此模式，`dialog.tsx:62`）。
- Dialog：`dialog.tsx` 已有 `w-full max-w-[calc(100%-2rem)] sm:max-w-lg`，验证即可。
- 表单字段堆叠（`grid-cols-*` 如有改 `grid-cols-1 sm:grid-cols-*`），`DateTimePicker` 日历弹层验证宽度。

### 3.4 其他页面

- `StatsPage`：已有 `md:` 降级，验证为主；图表容器确保 `min-w-0`。
- `SettingsPage`：`max-w-md` 内容宽度天然适配，验证 Tabs 在窄屏可滚动或换行。
- `AuthPage`：`max-w-sm` 居中，天然适配。

## 4. 数据流与兼容性

- 无后端/API/数据模型变更。
- `PageId` 路由类型不变，仅渲染层分流。
- 桌面回归风险点：Shell 结构调整时必须保证 ≥768px 渲染路径与现状 DOM 等价（现有测试守护）。

## 5. 测试策略

- 单元/组件测试（vitest + testing-library）：
  - `MobileTabBar` 渲染 5 个 Tab、点击切换回调、激活态。
  - Shell：mock `useIsMobile` 两侧断言（移动端无 sidebar/有 TabBar；桌面有 sidebar/无 TabBar）。
  - Timeline：触屏（mock isMobile）下 track 不绑定拖拽（pointerdown 无 onDragCreate 调用）；桌面不变。
- 既有测试回归：`App.test.tsx`、`HierarchicalListCard.test.tsx`、`use-mobile.test.ts` 等不改断言应全绿。
- 手动验收：375px 视口逐页走 AC1–AC6。

## 6. 回滚

纯前端改动、无数据迁移；单 commit（或按 R1/R2/R3 分 commit）可整体 revert。
