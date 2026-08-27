# Design: Toggl-style date switcher

## 概述

在 Timer 页时间线头部增加 Toggl 风格的日期导航（`← [标签] → [回到今天]` + 点击标签弹日历），后端 today/week 接口支持可选 `date` 参数指定查看的日期。StatsPage 与计时条不受影响。

## 后端设计

### `date` query 参数

`GET /api/entries/today?tz=&date=YYYY-MM-DD` 与 `GET /api/entries/week?tz=&date=YYYY-MM-DD`：

- 可选；缺省时行为与现状完全一致（以 `deps.now()` 为锚点）
- 提供时：作为"锚点日期"解释为 `tz` 时区的本地日期
- 校验失败（非 `YYYY-MM-DD` 格式或不存在如 `2025-02-30`）→ 400 `VALIDATION`，与 `requireTz` 风格一致
- 允许任意过去或未来日期（用户明确要求不禁用未来）

### time.ts 新增辅助函数

```ts
/** 将 "YYYY-MM-DD" 解释为 tz 本地日期，返回该天 [start, end) 边界。
 *  校验失败返回 null（调用方转 400）。 */
export function parseDateParam(date: string, tz: string): DateTime | null
```

- 用 `DateTime.fromISO(date, { zone: tz })`；`isValid === false` → null
- day 边界：`startOf("day")` / `plus({ days: 1 })`，复用 `todayBounds` 的换算模式（UTC ISO-Z）
- week 边界：该日期所在 ISO 周 `startOf("week")`，复用 `weekBounds` / `weekDayBounds` 的 DST 模式
- `todayBounds` / `weekBounds` / `weekDayBounds` 重构为接收一个 luxon `DateTime` 锚点（或在内部先归一化到当天 00:00），`listToday`/`listWeek` 把 `date` 参数归一化后传入——避免复制粘贴边界逻辑

### entries.ts

- `listToday(db, userId, tzRaw, now, opts?: { date?: string })`：`date` 存在时用 `parseDateParam` 得到的边界替代 `todayBounds(tz, now)`；`clipSeconds` 的 `now` 仍传 `deps.now()`（运行中条目按真实当前时间裁剪，历史日期窗口内不会有运行中条目，语义安全）
- `listWeek(db, userId, tzRaw, now, opts?: { date?: string })`：同理，锚定该日期所在周
- 路由层（`routes/today.ts`）抽取 `date` query 参数并传入，无效日期返回 400

### 测试

`server/test/today.test.ts` / `week.test.ts` 增加：
- 传 `date` 时返回该日/该周数据（含跨午夜 tz fixture，如 Asia/Shanghai 的 date=2026-08-20）
- 非法 date（`not-a-date`、`2025-02-30`）→ 400
- 不传 date 时返回不变（现有用例即回归保障）

## 前端设计

### 日期状态（TimerPage）

```ts
// "YYYY-MM-DD" | null；null = 今天（默认）。localStorage["chronolog-date-view"]
const [date, setDate] = useState<string | null>(loadDateView());
```

- localStorage 读写包 try/catch（沿用 use-theme.ts 模式）
- 选中日期变化时重新拉取对应数据

### 数据流

- `api.todayEntries(tz, date?)` / `api.weekEntries(tz, date?)` 增加可选参数，`date` 非空时拼到 query
- `TimerPage.refresh()` 按 `date` 拉取 day 数据；week 数据按需加载，`onModeChange`/日期变化时同理
- 计时条（TimerBar）与 `props.current` 完全不动；`today` state 更名为 `day`（或保留名字）仅影响时间线数据
- 开始/停止计时后的刷新逻辑：始终刷新"当前查看日期"的数据；若查看的不是今天，还需刷新今天的运行条目切片——简化：**运行中计时条只依赖 `props.current` + nowMs，不依赖时间线数据**，因此查看过去日期时 start/stop 只需刷新当前查看日期的数据 + `api.current()`

### UI（Timeline 头部）

现头部为 `[day/week Tabs] [日期标签]` + 右侧合计。改为：

```
[day/week Tabs] [←] [标签(可点开日历)] [→] [✕回到今天]      (合计已移除则右留空；本任务不动合计)
```

- 新组件 `DateNav`（`components/DateNav.tsx`）：
  - props: `view`, `date: string | null`, `tz`, `onChange(date: string | null)`
  - `←`：day 视图日期 -1；week 视图 -7（均按 tz 本地日历）
  - `→`：day +1 / week +7；始终可用（允许切到未来）
  - 标签：null → "今天"/"本周"（i18n）；否则 day 显示该日 `M月d日 周X`，week 显示 `M月d日 – M月d日`（复用/仿照 `formatWeekLabel`）
  - 点击标签 → Popover 内 `Calendar`；任意日期可选
  - "今天"文字按钮：仅 `date !== null` 时显示，点击回 null（今天）
- Calendar 组件：shadcn/ui 的 calendar 依赖 `react-day-picker` + `date-fns`，当前未安装 → 需新增依赖 `react-day-picker`（含 date-fns）。若安装受阻，降级方案：Popover 内放 7×N 月份网格自绘（备选，优先用标准组件）
- 视图联动（R6）：week 视图的 `date` 参数传"所查看周内任意一天"（后端归一化到该周）；day→week 切换时 date 不变，自然落在同一周；week→day 时若当前 date 为 null 保持 null，否则保留原 date
- `Timeline` 头部标签改由 `DateNav` 渲染，`headerLabel`/`total` 的合计显示保持现状不动（R9 明确不加合计，但也不移除现有的）

### i18n

新增 key（zh/en）：`timeline.today`（今天）、`timeline.thisWeek`（本周）、`timeline.backToToday`（回到今天）。day 标签复用现有日期格式化。

## 兼容与回滚

- 后端改动纯增量（可选参数），旧前端不受影响；回滚只需 revert 前端 date 状态与 DateNav
- localStorage key 与 theme 的命名风格一致：`chronolog-date-view`

## 明确不做

- StatsPage 跟随日期（R10）
- 合计时长新增显示（R9）
- 未来日期限制（前端与后端均允许未来，用户要求）
- 键盘快捷键（T 回今天）——可后续加