# 计时页当天/本周视图切换 — 技术设计

## 边界与数据流

### 后端

新增 `weekBounds(tz, now)`（`server/src/time.ts`）：

- 用 luxon 将 `now` 转到 `tz`，取 `startOf("week")`（luxon 默认周一为一周起点，符合 ISO 周）
- 返回 `{ weekStart, weekEnd }`，`weekEnd = weekStart + 7 天`，均为 UTC ISO-Z 字符串
- 与 `todayBounds` 同构，复用 `requireTz` 校验

新增 `listWeek(db, userId, tzRaw, now)`（`server/src/entries.ts`）：

- 计算 `weekBounds`，用现有 `overlap(userId, weekStart, weekEnd)` 一次查询整个周窗口的记录（避免 7 次查询）
- 对每条记录，按 7 个 `[dayStart_i, dayEnd_i)` 窗口分别 `clipSeconds`，得到该记录在每天的分段
- 输出 `{ tz, weekStart, weekEnd, days: TodayEntries[] }`，`days` 为 7 个元素，按周一至周日排序，每个元素结构与 `listToday` 返回一致（`dayStart/dayEnd/entries/totalClippedSeconds`）
- 每条 entry 的 `clippedSeconds` 为该天窗口内的裁剪值；`durationSeconds` 保持未裁剪全长

新增路由（`server/src/routes/today.ts`）：

```
GET /api/entries/week?tz=<IANA>
```

- 复用 `tzQuery` 与 `requireUser`，返回 `listWeek` 结果
- 无效/缺失 tz → 400 `VALIDATION`（与 today 一致）

### 前端

`web/src/api.ts`：

- 新增类型 `WeekEntries = { tz: string; weekStart: string; weekEnd: string; days: TodayEntries[] }`
- 新增 `api.weekEntries(tz)` → `GET /api/entries/week?tz=...`

`web/src/format.ts`：

- 新增 `formatWeekLabel(weekStart, weekEnd, tz)`：周范围文案（如 `8月25日 – 8月31日`），复用 `localeFor`
- 新增 `formatWeekdayLabel(iso, tz)`：列头星期文案（周一…周日），复用 `localeFor`

## 组件结构

### Timeline 改造（`web/src/components/Timeline.tsx`）

现状：单日渲染（ruler + track + blocks + now-line + 头部）。

改造方案：把单日渲染抽为内部子组件 `DayColumn`（props：`day: TodayEntries | null`、`nowMs`、`tz`、`isToday`），复用现有 ruler/track/block/now-line 逻辑。`Timeline` 变为模式分发：

- `mode="day"`：渲染 1 个 `DayColumn`（现状行为，头部显示当天标签 + 当天总时长）
- `mode="week"`：渲染 7 个 `DayColumn` 并排（横向滚动容器），头部显示周范围 + 本周总时长；列头显示星期 + 当天总时长；now-line 仅出现在今天列

周视图布局：

- 外层 `overflow-x-auto`，内层 7 列 `min-w-[...]` 并排（flex）
- 每列高度与当天视图一致（24h 刻度），垂直滚动定位到当前时间（复用现有 `scrollRef` 逻辑，滚动到今天列当前时间）
- 列头：星期标签 + 当天总时长（`formatDuration`）

### TimerPage 改造（`web/src/pages/TimerPage.tsx`）

- 新增页面级 state：`view: "day" | "week"`（默认 `"day"`），不持久化
- 新增 state：`week: WeekEntries | null`
- 切换视图时按需加载：切到 week 且未加载过则 `api.weekEntries(tz)`；切回 day 用已有 `today`
- `onToggle`（开始/停止）后同时刷新 `today` 与 `week`（或仅刷新当前视图，二选一：刷新当前视图即可，切回另一视图时再按需加载）
- 头部切换控件：shadcn `Tabs`（`web/src/components/ui/tabs.tsx` 已存在），放时间线头部，`aria-label` i18n
- 周总时长 = 7 天 `totalClippedSeconds` 之和（后端已算好，前端直接求和）

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 周窗口查询 | 一次查询 + 按天分组裁剪 | 避免 7 次 DB 查询；clip 语义与 today 完全一致 |
| 周视图渲染 | 复用单日渲染为 `DayColumn` | 避免复制 ruler/block/now-line 逻辑（spec: code-reuse） |
| 视图状态 | 页面级 state，不持久化 | 符合 spec: state-management（无 store） |
| 切换控件 | shadcn Tabs | 项目已有该组件，符合 shadcn 规范 |
| 数据刷新 | 开始/停止后刷新当前视图；切换视图按需加载 | 最小请求量 |

## 兼容性

- 现有 `GET /api/entries/today` 与 `TodayEntries` 结构不变，当天视图零回归
- 新增端点/类型/组件为纯增量
- 无 DB schema 变更，无环境变量变更

## 测试

- `server/test/week.test.ts`（新增）：
  - 无效/缺失 tz → 400
  - 周窗口边界正确（周一 00:00 起，7 天）
  - 跨天记录在两天各显示一段，时长按天裁剪
  - 运行中条目在当天列实时计入
  - 用户隔离（复用 isolation 模式）
- 前端无测试框架，以 `npm run typecheck` + `npm run build` 验证
