# Adopt Toggl 2.0 layout/form style (keep current palette)

## Goal

将 Chronolog 的 UI **布局与控件形态**改造为 Toggl Track 2.0 风格（参考：用户提供的两张 Toggl 截图，Timer 日视图 / Reports 页）。**配色保持现状**（现有灰色 token、categoryColor 均不变）。

## 参考形态特征（配色除外）

- 顶栏 = 描述性大标题（或计时输入条）+ 右侧操作
- 计时条为通栏表单式：大号输入框 + 描边控件 + 计时 + 圆形播放按钮
- 摘要区：大号粗体数字卡，白底 1px 边框
- 侧边栏：小号大写灰色分组标题
- 扁平、1px 浅边框 + 圆角、留白充足

## Requirements

1. **Shell 顶栏**（`web/src/components/Shell.tsx`）：新增 `header?: ReactNode` prop；顶栏 `[SidebarTrigger][header]`，高度 `min-h-12`。非 Timer 页 header 为页面大标题（`nav.*` i18n），对应页面删除自身 `<h1>`。
2. **Timer 激进版**：TimerBar 进入顶栏（Toggl "What are you working on?" 式）。抽取 `web/src/hooks/use-timer-controller.ts` 持有 Timer 页全部状态与动作（从 `TimerPage.tsx` 原样迁移）；App 组装 `header=<TimerBar>` + children `<Timeline>`；删除 `TimerPage.tsx`。
3. **TimerBar 形态**（`web/src/components/TimerBar.tsx`）：输入框 `text-lg` 占满、picker 改 `rounded-lg` 描边、计时 `text-xl` mono、去外层 border-b；播放按钮保持圆形实心。
4. **统计摘要卡**（`web/src/pages/StatsPage.tsx`）：顶部新增总时长卡（1px 边框 rounded-lg，label `stats.totalLogged`，数值 `text-3xl font-bold tabular-nums`），数据 = `stats.categories` 求和，不加 API；删除页面 h1。
5. **侧边栏分组标签**（`ShellNav`）：`SidebarGroupLabel` + i18n `nav.group`（中：菜单 / 英：Menu）。
6. **Categories/Tags 页**：删 h1，其余不动。
7. **i18n**：zh/en 增加 `nav.group`、`stats.totalLogged`。

## Out of Scope

- 配色、dark 模式 token、categoryColor 色板（`web/src/format.ts`）
- Timeline 内部（工具行/day-week 切换/DateNav 已是 Toggl 式）
- AuthPage、EntryEditor popover、CategoryPicker/TagPicker 交互逻辑
- API、DTO、路由

## Acceptance Criteria

- [ ] 顶栏：统计/分类/标签页顶栏显示页面大标题，页面内无重复 h1
- [ ] Timer 页：计时条渲染在顶栏内，输入框/控件/计时/播放按钮形态符合 R3；Timeline 在内容区正常渲染
- [ ] 计时开始/停止、running 时侧边栏 badge 计时、刷新后 running 恢复均不回归
- [ ] day/week 切换、日期切换、条目编辑 popover、刻度切换均不回归
- [ ] 统计页顶部出现总时长摘要卡，数值正确（= 各分类秒数和）
- [ ] 侧边栏出现大写分组标签
- [ ] `npm run typecheck -w web`、`npm run build -w web` 通过
- [ ] 无 `TimerPage` 残留引用；zh/en 语言包无缺失 key

## Resolved Decisions

- 改造深度：布局形态全面靠拢，TimerBar 进顶栏（激进版，用户确认）
- 配色：不变；dark 模式逻辑维持现状；categoryColor 不动
- StatsPage 摘要卡：纳入（参考形态"大数字摘要卡"的直接落点）

## 技术方案与执行计划

见 `design.md` / `implement.md`。
