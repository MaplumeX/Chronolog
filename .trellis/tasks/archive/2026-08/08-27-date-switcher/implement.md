# Implement: Toggl-style date switcher

执行顺序：后端 → 前端 api → 前端 UI → 校验。每步之后跑对应验证命令。

## Step 1: 后端 date 参数

- [ ] `server/src/time.ts`：新增 `parseDateParam(date: string, tz: string): { dayStart, dayEnd } | null`（luxon `fromISO(date, { zone: tz })`，isValid 校验）；`todayBounds`/`weekBounds`/`weekDayBounds` 支持传入锚点日期（保持现有签名向后兼容或内部归一化），DST 规则不变（day 窗口从本地日历推导，禁止 `+i*86400000`）
- [ ] `server/src/entries.ts`：`listToday` / `listWeek` 增加可选 `date` 参数（第 5/4 位或 opts 对象），date 有效时用其边界；`clipSeconds` 的 now 不变
- [ ] `server/src/routes/today.ts`：`/api/entries/today`、`/api/entries/week` 抽取 `date` query，无效 → 400 `VALIDATION "日期无效"`
- [ ] 测试：`server/test/today.test.ts` + `week.test.ts` 增加 date 用例（有效过去日期、非法格式、`2025-02-30`、跨午夜 tz fixture）
- 验证：`npm test -w server`

## Step 2: 前端 api + 状态

- [ ] `web/src/api.ts`：`todayEntries(tz, date?)` / `weekEntries(tz, date?)` 可选参数，非空时 `&date=` 拼接
- [ ] `web/src/pages/TimerPage.tsx`：
  - 新增 `date: string | null` state + localStorage `chronolog-date-view` 读写（try/catch）
  - `refresh` / `onModeChange` / `refreshEntries` 按 `date` 拉取；date 变化时重新拉取对应视图数据
  - 计时条逻辑（TimerBar / props.current / elapsed）完全不动
- 验证：`npm run typecheck -w web`

## Step 3: DateNav 组件

- [ ] 新增依赖 `react-day-picker`（如需则含 `date-fns`）；创建 `web/src/components/ui/calendar.tsx`（shadcn 标准封装，适配现有 tailwind v4 + 主题变量）；若依赖安装受阻，按 design.md 降级方案自绘月份网格
- [ ] 新增 `web/src/components/DateNav.tsx`：
  - `← →`：按视图粒度 ±1 天 / ±7 天（tz 本地日历，用 `Intl`/原生 Date 按本地日期字符串运算，避免 UTC 偏移）
  - 始终可用（允许切到未来）；日历任意日期可选
  - 标签：null → `今天`/`本周`；非 null → `M月d日 周X`（day）/ `M月d日 – M月d日`（week）
  - Popover + Calendar 选日期，选中即 `onChange(YYYY-MM-DD)` 并关闭
  - `今天` 文字按钮：仅 `date !== null` 显示，点击回今天/本周
- [ ] `Timeline.tsx`：头部嵌入 `DateNav`（替换静态 `headerLabel`）；day/week 切换与滚动锚点逻辑适配非今天的锚定（day 模式滚动锚点改为所查看日期）
- [ ] i18n：`timeline.today` / `timeline.thisWeek` / `timeline.backToToday`（zh + en）
- 验证：`npm run typecheck -w web`，`npm run dev` 手动验证 AC1–AC6、AC8

## Step 4: 全量校验

- 验证：`npm run typecheck` && `npm test -w server`
- 对照 prd.md AC1–AC10 逐条核对

## Review gates

- Step 1 完成后：检查 DST 规则未被破坏（weekDayBounds 逐日推导保持）
- Step 3 完成后：视觉检查 light/dark 两主题下 DateNav + Calendar 显示

## Rollback points

- Step 1 独立可回滚（可选参数，不影响现有调用）
- Step 2/3 一起回滚（前端 date 状态与 DateNav 相互依赖）