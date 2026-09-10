# 移动端计时器底部停靠胶囊 — 技术设计

## 目标形态

移动端（<768px）timer 页：

```
┌────────────────────────────┐
│ header: 「计时」 + ⚙        │  ← 与其他页统一（min-h-12 + border-b）
│                            │
│  Timeline / EntryListView  │  ← 内容区，可滚动
│                            │
├────────────────────────────┤
│ ● 写周报… 0:42:17   (▶)    │  ← 停靠胶囊（fixed，Tab 栏上方）
├────────────────────────────┤
│  ⏱  📊  🎯  🗂  🏷         │  ← MobileTabBar（不动）
└────────────────────────────┘
```

点胶囊非按钮区域 → bottom sheet 展开（描述 / 分类 / 标签 / 运行中标签 / 错误）。

## 组件与数据流

### 新组件 `web/src/components/MobileTimerDock.tsx`

纯展示组件，不 import `api`，数据全部来自 `timer.barProps`（`use-timer-controller` 现有
输出，零改动）。props 与 `TimerBar` 对齐（多一个 `title?: string`）。

内部结构：

```tsx
<Sheet open onOpenChange>            // 展开态（仅移动端渲染本组件）
  <SheetTrigger asChild>
    <button 胶囊行>                   // 色点+描述摘要+时长（可聚焦、aria-haspopup="dialog"）
      <Button 开始/停止/>             // stopPropagation，不触发 sheet
    </button>
  </SheetTrigger>
  <SheetContent side="bottom">       // 复用 TimerBar 的编辑内容排布
    描述 input / CategoryPicker / TagPicker 或运行中标签 chips / error
  </SheetContent>
</Sheet>
```

- 停靠定位：`fixed inset-x-0 bottom-[calc(var(--mobile-tabbar-h)+env(safe-area-inset-bottom))] z-40`，
  `--mobile-tabbar-h` 定义为常量（MobileTabBar 实测高度 48px，与组件 `min-h-[48px]` 对应），
  写入 `styles.css` `:root`。
- 胶囊视觉：`bg-card border-t`（与 Tab 栏同材质，视觉上为 Tab 栏的延伸层），行内
  `items-center gap-3 px-4 min-h-14`。不引入浮起阴影（遵守轻卡片规范）。
- 摘要行：分类色点（`paletteColor`，`running ?? selected`）+ 描述单行 `truncate`
  （空则 `timer.placeholder`）+ 标签 chips（空间允许时渲染，`flex-1 min-w-0` 容器内
  `hidden sm:flex` 收窄策略不做——直接不渲染多余 chips，全部标签在展开态可见）+
  时长 `font-mono tabular-nums text-base` 右侧 + 按钮。
- 按钮：复用 `TimerBar` 现有规格（`size-11 rounded-full`，default/destructive 变体，
  `Play`/`Square` 图标），`onClick` 需 `e.stopPropagation()` 防止冒泡开 sheet。
- 内容区 padding：胶囊常驻后，timer 页内容区底部 padding 需在现有
  `pb-[calc(5rem+env(safe-area-inset-bottom))]` 基础上追加胶囊高度
  （`+3.5rem`），仅 timer 页生效。

### `Shell.tsx` 移动端分支改动

- `page === "timer"` 时 header 不再接收 `TimerBar`，改由 `App.tsx` 统一传页面标题
  （`HEADER_TITLE_KEYS` 机制已有）。
- 移动端分支新增条件渲染：`page === "timer" && <MobileTimerDock {...timerBarProps} />`，
  放在 `MobileTabBar` 之后、同一 flex 容器内（fixed 定位，不占 flex 空间）。
- 停靠胶囊的数据需要从 `App` 传入 `Shell`：新增 `header` 之外的可选 prop
  `mobileTimerDock?: ReactNode`（保持 Shell 的"纯容器 + ReactNode 插槽"风格，不把
  timer 业务 props 拆进 Shell）。

### `App.tsx` 改动

- `header` 三元简化为统一标题（timer 页与其他页一致走 `HEADER_TITLE_KEYS`）。
- 移动端 dock 的组装放在 `App`：`const mobileTimerDock = <MobileTimerDock {...timer.barProps} />`，
  通过新 prop 传给 `Shell`。桌面端 `Shell` 忽略该 prop（`md` 以上不渲染）。
  （组装逻辑留在 `App`，遵循"App is the sole assembler"规范。）

### 展开态（bottom sheet）内容

- 直接复用 `TimerBar` 的输入组件排布（描述 input、`CategoryPicker`、`TagPicker`、
  运行中标签 chips、error `<p>`），纵向布局同现有移动端 `TimerBar` 的 `flex-col`。
- 不复用 `ResponsiveEditPopover`：它服务于"锚定到触发元素的编辑浮层"（anchor/side 等
  桌面透传契约），本场景是全宽停靠条的固定展开，直接用 `ui/sheet` 更简单，且
  `#51` 的 sheet 规格已内建（`max-h-[85dvh]` 滚动、drag-handle、safe-area padding）。
- sheet 内开始/停止按钮**不渲染**（胶囊上的按钮已承担该操作，sheet 专注编辑）。
- `CategoryPicker` 的 `categoryPickerAutoOpen`（连续计时自动展开选分类）在 sheet
  场景下行为：保留现有受控 `open` 逻辑——auto-open 时 sheet 内 DropdownMenu 打开。
  **注意**：`CategoryPicker` 是 DropdownMenu，嵌在 Sheet（Radix Dialog）内可正常弹出
  （portal 到 body）。若实测出现焦点冲突，退路是在 sheet 内改用 inline 列表形态
  （实现时验证，不预先复杂化）。

### 状态与业务逻辑

- **零改动**：`use-timer-controller` 的 `barProps`、running/stopped 双态草稿、600ms
  debounce、immediate PATCH、错误处理全部照旧——dock 只是新的视图层。
- `canStart=false`（未选分类）时按钮 disabled，与现行为一致；胶囊摘要行仍可点开
  sheet 选分类。
- 停止计时后：描述/分类/标签表单重置为"新条目"草稿（现有 hook 行为，dock 无需处理）。

## 兼容性

- **桌面端**：`Shell` 桌面分支不渲染 `mobileTimerDock` prop；`header` 继续是
  `TimerBar`——但 `App` 侧 header 已统一为标题，因此桌面 timer 页 header 变为
  顶栏标题 + `TimerBar`。**这里与 PRD R4 有冲突**：见下。
  → **决策**：`App` 按宽度分流由 `Shell` 内部处理太复杂，改为 `App` 继续在
  `page === "timer"` 时给 `header` 传 `TimerBar`，同时新增 `mobileTimerDock` 传
  dock；`Shell` 移动端分支**忽略 header prop 的 TimerBar**（timer 页显示标题），
  桌面分支不变。即：`App` 的 header 组装逻辑完全不动，只有 `Shell` 移动端分支
  在 `page === "timer"` 时用 `t("nav.timer")` 标题替换 header 内容。
- 测试影响：
  - `Shell.test.tsx`：移动端 timer 页断言需更新（标题出现、TimerBar 不在 header 内）。
  - `App.test.tsx`：若 mock 了视口宽度，补移动端 dock 渲染断言。
  - `use-timer-controller.test.tsx`：不受影响（纯 hook）。
  - 新增 `MobileTimerDock.test.tsx`：胶囊渲染、sheet 打开/关闭、按钮 stopPropagation、
    running/stopped/disabled 态。

## 备选与取舍

- **胶囊放 Tab 栏内部（作为 Tab 栏上层）vs 合并进 Tab 栏**：合并会破坏 5-tab 等分布局
  且 MobileTabBar 是通用组件，不侵入。
- **sheet 复用 `ResponsiveEditPopover`**：契约不匹配（anchor 桌面透传），放弃。
- **胶囊 sticky 而非 fixed**：Tab 栏是 fixed，sticky 需要内容区配合滚动容器嵌套，
  fixed + 底部 padding 追加更简单直接。

## 回滚

单次提交，revert 即可整体回滚；无数据/样式 token 变更（仅新增 `--mobile-tabbar-h`）。
