# 执行计划：网站移动端适配

## 顺序清单

### Step 1 导航（R1 / AC2）

- [ ] 新建 `web/src/components/MobileTabBar.tsx`：5 Tab + 激活态 + i18n + 图标（复用 `Shell.tsx` 的 `ITEMS`）。
- [ ] 改造 `Shell.tsx`：移动端不渲染 Sidebar（Sheet），渲染移动端 header（标题 + 设置入口）+ `MobileTabBar`；桌面路径 DOM 不变。
- [ ] `SidebarInset` 内容底部留 `pb-20 md:pb-0` 防 Tab 栏遮挡；Tab 栏 `pb-[env(safe-area-inset-bottom)]`。
- [ ] i18n：如需新 key（如移动 header 标题），补 `zh`/`en`。
- [ ] 测试：MobileTabBar 组件测试 + Shell 两侧（mock `useIsMobile`）测试。

### Step 2 时间线（R2 / AC3、AC4）

- [ ] Week 视图：week 内容包统一宽度容器（`w-max`），验证表头/列/ruler 对齐 + 横向滚动；加 `overscroll-behavior-x: contain`。
- [ ] 触屏禁拖：`Timeline.tsx` 父层 `onDragCreate={isMobile ? undefined : ...}` 传给 `DayColumn`。
- [ ] `styles.css` 加 `@media (max-width: 767px)`：刻度尺 44px / font-size 11px；工具条 gap 缩小或允许 wrap。
- [ ] 测试：mock isMobile 断言触屏不触发拖拽创建；桌面用例不回归。

### Step 3 全局组件与页面（R3 / AC1、AC5、AC6）

- [ ] `HierarchicalListCard` 菜单按钮等扩触屏命中区（≥40px hit area）。
- [ ] Goals / Tokens 表格容器 `overflow-x-auto`。
- [ ] Popover/Dialog 窄屏宽度约束（`max-w-[calc(100vw-2rem)]`）；逐个过 EntryEditor、GoalEditorDialog、DateTimePicker、ConfirmDialog。
- [ ] StatsPage / SettingsPage / AuthPage 验证 + 小修。

### Step 4 验证与收尾（AC1–AC7）

- [ ] 375px 视口手动走查六页 + 核心闭环（AC5）。
- [ ] `npm run typecheck` && `npm test` && `npm run build -w web`。
- [ ] 既有测试全部回归通过。

## 验证命令

```bash
npm run typecheck
npm test
npm run build -w web
```

## 风险文件与回滚点

- `web/src/components/Shell.tsx`：桌面渲染路径必须等价，回归靠现有 Shell/集成测试。
- `web/src/components/Timeline.tsx`（789 行）：拖拽禁用只动 prop 传递，不动 handler 内部逻辑。
- `web/src/styles.css`：新增 media query 块独立、可整体删除回滚。
- 建议按 Step 1/2/3 分别 commit，任一步可独立 revert。
