# 移动端计时器改为底部停靠胶囊

## Goal

移动端（<768px）计时页不再把 `TimerBar` 塞进顶部 header，改为**固定在底部 Tab 栏上方的停靠胶囊**：
常驻显示描述摘要 + 分类色点 + 已计时时长 + 开始/停止按钮；点胶囊（按钮除外）展开 bottom sheet
编辑描述、分类、标签。桌面端保持现状不动。

## Background

- 现状：移动端 `Shell` 的 header（`border-b` 工具栏形态）内嵌整个 `TimerBar`，垂直堆叠成
  180px+ 的"表单"块，占据首屏过多空间且视觉杂乱。
- 用户反馈：不喜欢移动端计时界面的 header 形态，希望脱离 header 形式。
- 选定方案：底部停靠胶囊（方案 2），常驻 + 单手可达 + 与 #51 引入的移动端 bottom sheet
  模式风格统一。

## Scope

- **In scope**
  - `web/src/components/Shell.tsx` 移动端分支：timer 页 header 简化（页面标题 + 设置入口）
  - 新增移动端停靠胶囊组件（Tab 栏上方常驻）
  - 停靠胶囊展开态（bottom sheet）内编辑：描述、分类、标签
  - 运行中标签 chips 展示（胶囊内或展开态，设计定）
- **Out of scope**
  - 桌面端（≥768px）布局与 `TimerBar` 桌面形态
  - 计时业务逻辑（`use-timer-controller` 的 API 调用、状态机）
  - 底部 Tab 栏本身（`MobileTabBar` 保持不变）
  - 其他页面

## Requirements

### R1 移动端 timer 页去掉 header 内嵌 TimerBar
- 移动端进入 timer 页时，header 只显示页面标题（与其他页一致）+ 设置齿轮入口。
- header 高度回归其他页面的统一规格（min-h-12、border-b）。

### R2 底部停靠胶囊（常驻）
- 仅 timer 页且移动端渲染，固定在 `MobileTabBar` 正上方，不随内容滚动消失。
- 胶囊内容（自左向右）：
  - 分类色点 + 描述摘要（无描述时显示 placeholder 文案），单行截断
  - 运行中的标签（若有多余空间，以小 chips 呈现；放不下时收进展开态，具体设计定）
  - 已计时时长（`tabular-nums`，右对齐）
  - 开始/停止圆形按钮（与现有 `TimerBar` 一致：default/destructive 变体）
- 未开始且分类未选时（`canStart=false`），按钮禁用，与现行为一致。
- 计时进行中切到其他 Tab 时胶囊仍可见与否：不可见（胶囊仅 timer 页渲染），
  运行状态由 Tab 栏/现有机制承担（不在本任务扩展）。

### R3 展开编辑 bottom sheet
- 点胶囊非按钮区域打开 bottom sheet，内容含：
  - 描述输入（多行或单行，设计定；绑定逻辑同现有 `TimerBar` 的 running/stopped 双态）
  - 分类选择器（复用 `CategoryPicker` 或其在 sheet 内的形态）
  - 标签选择器（复用 `TagPicker`）
  - 运行中显示当前标签 chips
  - 错误信息（`error`）展示
- sheet 交互遵循 #51 的移动端 bottom sheet 模式（如 `ResponsiveEditPopover` / shadcn Sheet）。
- 关闭 sheet 不影响计时状态。

### R4 桌面端不变
- ≥768px 仍为：侧栏 + header 内 `TimerBar`，行为与样式不变。

### R5 兼容与可访问性
- 胶囊与 sheet 需键盘可达、有 aria-label。
- 时长与按钮状态在 running/stopped、错误态下展示正确。
- 不破坏现有 `App.test.tsx` / `Shell.test.tsx` / `use-timer-controller.test.tsx` 语义，
  受影响的测试随结构调整更新。

## Acceptance Criteria

- [ ] 移动端 timer 页 header 只剩标题 + 设置入口，高度与其他页一致
- [ ] 停靠胶囊固定在 Tab 栏上方，常驻显示摘要、时长、开始/停止按钮
- [ ] 点胶囊非按钮区域打开 bottom sheet，可编辑描述/分类/标签，关闭不影响计时
- [ ] 运行中/未运行/分类未选（按钮禁用）/错误态展示正确
- [ ] 桌面端（≥768px）视觉与交互与改动前一致
- [ ] `npm run check`（或项目等价命令）通过，含测试与 lint

## References

- `web/src/components/Shell.tsx`（移动端分支、header 结构）
- `web/src/components/TimerBar.tsx`（现有计时条，桌面继续使用）
- `web/src/components/MobileTabBar.tsx`（底部 Tab 栏）
- `web/src/hooks/use-timer-controller.tsx`（`barProps` 数据源）
- `web/src/components/ResponsiveEditPopover.tsx`（#51 bottom sheet 模式参考）
