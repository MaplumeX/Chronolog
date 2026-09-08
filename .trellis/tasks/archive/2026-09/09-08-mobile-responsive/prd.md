# 网站移动端适配

## Goal

让 Chronolog Web 端在移动端（手机竖屏为主，约 375–430px 宽）获得完整可用的触屏体验：布局不溢出、不横向错乱，核心操作（计时、查看/编辑条目、导航）在触屏上可完成。这是触屏体验重设计（含移动端专属导航模式），不是仅修布局的可用性补丁。

## Background（代码库排查确认）

- 技术栈：Tailwind CSS v4 + shadcn/ui + Vite + vitest；`web/index.html` 已有 viewport meta。
- `web/src/styles.css` 无任何 `@media` 查询，时间线几何（刻度尺 56px、色块文字等）全部固定像素。
- 已有基础：`useIsMobile()` hook（`web/src/hooks/use-mobile.ts`，768px 断点）；shadcn sidebar（`web/src/components/ui/sidebar.tsx`）内置移动端 Sheet 抽屉，`Shell.tsx` 已接线。
- 已有部分响应式：`TimerBar`（`md:flex-row`）、`StatsPage` 概览区（`md:flex-row`）与统计表格窄屏列宽。
- 主要问题点（file:line 锚点）：
  - `Timeline.tsx:697,727` week 视图 7 列 `min-w-[180px]`，手机竖屏必然溢出（内容宽 ≥ 1260px）；day 视图刻度尺 56px + 色块文字 13px/12px 在窄屏偏挤。
  - `Timeline.tsx:178-235` 拖拽创建走 pointer 事件；触屏无 hover，拖拽与滚动手势冲突。
  - `HierarchicalListCard.tsx` 的 `⋯` 行菜单按钮（24px）触屏命中偏小。
  - `GoalsPage` / `TokensPage` 表格多列窄屏表现未验证（有 `overflow-hidden` 无 `overflow-x-auto`）。
  - `GoalEditorDialog` / `EntryEditor` / `DateTimePicker` 表单窄屏表现未验证。

## Requirements

### R1 移动端导航（信息架构）

- 移动端（< 768px）用底部 Tab 导航替换抽屉导航：5 个 Tab = 计时、统计、目标、分类、标签。
- 「设置」入口放移动端页面顶部右上角图标。
- 桌面端（≥ 768px）sidebar 布局与交互完全不变。

### R2 时间线（核心页面，计时页）

- Week 视图：容器允许横向滚动（`overflow-x-auto`），用户左右滑动查看整周。
- 触屏创建条目：仅点击 gap 插槽；触屏检测下禁用拖拽创建 handler（pointer 事件不绑定），避免与滚动冲突。桌面端拖拽行为不变。
- Day 视图刻度尺、色块文字等在 375–430px 宽下不溢出、可读。

### R3 全局布局与组件

- 所有页面在 375–430px 宽下无意外横向溢出（可滑动的 week 视图除外）。
- 触屏命中区不足的控件（如 24px 菜单按钮）扩到 ≥ 40px。
- Dialog / Popover 表单（EntryEditor、GoalEditorDialog、DateTimePicker 等）在窄屏完整可用、可滚动。
- 表格页（Goals、Tokens）窄屏可用（横向滚动或卡片式降级，design 阶段定）。

## Acceptance Criteria

- [ ] AC1 375px 宽视口下：计时、统计、目标、分类、标签、设置六页无意外横向溢出，无元素被裁切到不可达。
- [ ] AC2 移动端底部 5 Tab 可切换五个主页面，激活态清晰；设置从顶部右上角进入；桌面端 sidebar 行为与现状完全一致（现有 Shell 相关测试不回归）。
- [ ] AC3 Week 视图在手机竖屏可左右滑动查看全部 7 天，表头与列对齐不错位。
- [ ] AC4 触屏（无 fine pointer / 窄屏）下时间线不触发拖拽创建，点击 gap 插槽可创建条目；桌面端拖拽创建、点击编辑行为不变（现有 Timeline 测试不回归）。
- [ ] AC5 触屏可完成核心闭环：开始/停止计时 → 在时间线点 gap 新建条目 → 编辑保存 → 查看统计。
- [ ] AC6 关键触屏目标（行菜单按钮、Tab、时间线色块等）命中区 ≥ 40px。
- [ ] AC7 `npm run typecheck`、`npm test`、`npm run build -w web` 全部通过。

## Out of Scope

- 移动端新增视图形态（如 3 天视图）或后端 API 变更。
- 长按拖拽创建条目。
- 平板横屏专项优化（按桌面断点自然降级）。
- PWA / 离线能力。

## Key Decisions

1. 适配深度 = 触屏体验重设计（用户已确认）。
2. Week 视图 = 允许横向滚动（用户已确认）。
3. 触屏创建 = 仅点击 gap 插槽，禁用拖拽（用户已确认）。
4. 底部导航 = 5 Tab + 设置在顶部右上角，移动端去掉抽屉（用户已确认）。
