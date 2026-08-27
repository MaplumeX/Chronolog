# Design: Toggl 2.0 layout/form restyle (palette unchanged)

## 总体思路

配色不动，只改**布局骨架与控件形态**。核心结构改动是把"页面标题/计时条"统一收进 Shell 顶栏（Toggl 式：顶栏 = 描述性大标题或计时输入条 + 右侧操作），内容区只放工具行和主体。

## 架构与边界

### 1. Shell 顶栏改造（`web/src/components/Shell.tsx`）

- `Shell` 新增 `header?: ReactNode` prop。inset 顶栏渲染：`[SidebarTrigger] [props.header]`。
- 顶栏样式从固定 `h-12` 改为 `min-h-12`（Timer 计时条更高且移动端会换行）。
- 非 Timer 页：App 传入 `header = <页面标题>`（text-lg font-semibold，复用 `nav.*` i18n key）；对应页面删除自己的 `<h1>`。
- Timer 页：`header = <TimerBar .../>`，TimerBar 成为顶栏本身（"What are you working on?" 式）。

### 2. Timer 状态提升（激进版的关键）

TimerBar 进顶栏后，其状态（categories/tags/today/week/view/date/error/current + toggle/refresh 动作）必须与 Timeline 共享，而两者分属顶栏与内容区。

方案：抽取自定义 hook `useTimerController`（`web/src/hooks/use-timer-controller.ts`），持有 Timer 页全部状态与动作：

- state：`categories, tags, today, week, view, date, categoryId, tagIds, description, error`
- actions：`onToggle, onModeChange, onDateChange, refreshEntries`（逻辑原样从 `TimerPage.tsx` 迁移）
- 返回两组 view props：`barProps`（喂 TimerBar）、`timelineProps`（喂 Timeline）

`App.tsx`：`page === "timer"` 时调用一次 hook，`header` 传 `<TimerBar {...barProps} />`，children 传 `<Timeline {...timelineProps} />`。`TimerPage.tsx` 文件删除（或退化为薄组装层，二选一，倾向删除）。

- `nowMs`/`current`/`onCurrent` 仍由 App 持有（侧边栏 badge 也要用），作为参数传入 hook。
- DateNav、EntryEditor、CategoryPicker、TagPicker 组件接口不变。

### 3. TimerBar 形态（`web/src/components/TimerBar.tsx`）

对照 Toggl 截图调整（不改配色）：

- 输入框：placeholder 语义即 "What are you working on?"（沿用现有 `timer.placeholder`），字号提升到 `text-lg`，占满剩余宽度
- 右侧控件：Category/Tag picker 由 `rounded-full` 改为 `rounded-lg` 描边式，保持现有 Button outline
- 计时：mono tabular，字号略增（`text-xl`）
- 播放按钮：保持圆形实心（已符合 Toggl）
- 整条通栏：去掉外层 `border-b`（顶栏自带分隔线），高度自适应

### 4. 统计页摘要卡（`web/src/pages/StatsPage.tsx`）

- 顶部加一行大数字摘要卡（Toggl "Logged time" 卡）：白底 1px 边框 `rounded-lg`，label 小字（新增 i18n key `stats.totalLogged`：已记录时间/Logged time），数值 `text-3xl font-bold tabular-nums`
- 数据源：`stats.categories` 秒数求和（现有数据，不加 API）
- per-category 条形列表保持现状，移入卡片下方（或保持 divide-y 列表，仅去掉页面级 h1）

### 5. 侧边栏分组标签（`web/src/components/Shell.tsx`）

- `ShellNav` 加 `SidebarGroupLabel`（text-xs uppercase tracking-wide muted），i18n key `nav.group`（中：菜单 / 英：Menu）。仅一个分组，保持克制。

### 6. 其余页面对齐

- Categories/Tags：删 h1（标题进顶栏），其余不动
- AuthPage：独立页，不动
- Timeline 工具行：已在前序任务做过 Toggl 式日期切换，不动

## 数据流与契约

- 无 API 变更、无 DTO 变更、无路由变更
- `PageId` 不变；App 是唯一组装点
- hook 遵循 `.trellis/spec/frontend/hook-guidelines.md`（页面级 fetch/interval 约定照旧迁移）

## 兼容与回滚

- 移动端：顶栏 `min-h-12` + TimerBar 现有 `flex-col md:flex-row` 响应式保留；侧边栏 Sheet 打开逻辑不变
- 回滚点：改动集中在 Shell/App/TimerBar/StatsPage/新 hook，git revert 单 commit 即可

## Trade-offs

- 删除 `TimerPage.tsx`、状态入 hook：文件结构变化较大，但避免 props 层层上抛或 portal hack
- StatsPage 摘要卡是新增 UI（用户未逐项确认，但属于"摘要区大数字卡"参考形态的直接落点）
