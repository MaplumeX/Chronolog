# 修复跨天条目在时间线的几何裁剪与信息展示

## Goal

时间线（`Timeline.tsx`，day / week 两模式共用的 `DayColumn`）正确渲染跨午夜（跨天）条目：色块几何按当天窗口裁剪，且条目信息（时长、时间范围）展示该条目的完整情况并标清跨天的日属，使用户不被误导。

## Background / Problem

后端 `listToday` / `listWeek` 用 `overlap()`（`startedAt < dayEnd && stoppedAt > dayStart`）查询，跨天条目会正确进入其覆盖的每一天的 bucket；每条 EntryDto 同时带 `durationSeconds`（整条总时长，running 算到 now）与 `clippedSeconds`（当天窗口切片时长）。后端无 bug。

问题在前端 `Timeline.tsx` 色块渲染与信息文案：

1. **几何未裁剪**：色块定位直接用原始 `startedAt / stoppedAt` 计算 `top` 与 `heightPct`，`posPercent` 只把比例 clamp 到 0–100%。对「昨晚开始、今天结束」的条目（如 23:00→01:00），在**今天**这一列 `start` 落在昨天 → `top` clamp 到 0%，但高度仍按全长 2h 算 → 色块画成 00:00–02:00，**多占 1 小时**。
2. **时长用错字段**：块上时长用 `clipSeconds(...)` 只算当天切片 → 显示 1h，而条目总时长应为 2h。
3. **时间范围无日属**：`23:00 – 01:00` 看不出开始是昨天，跨天事实丢失。

对称地，在**昨天**那一列：色块应画 23:00–24:00，时长显示 2h，范围标出结束落在明天。

以 23:00（昨天）→ 01:00（今天）为例：

| 项目 | 现状 | 期望 |
|---|---|---|
| 今天列色块 | 00:00–02:00（画过头） | 00:00–01:00 |
| 今天列时长 | 1h（切片） | 2h（整条） |
| 今天列范围 | `23:00 – 01:00` | `昨天 23:00 – 01:00` |
| 昨天列色块 | 23:00–24:00（碰巧对） | 23:00–24:00 |
| 昨天列时长 | 1h | 2h |
| 昨天列范围 | `23:00 – 01:00` | `23:00 – 明天 01:00` |

## Requirements

- **R1 几何裁剪**：渲染前把条目起止夹到当天窗口 `[dayStart, dayEnd)`：`start = max(startedAt, dayStartMs)`、`end = min(stoppedAt ?? nowMs, dayEndMs)`，再据此算 `top` / `heightPct`。三种场景全部正确：昨晚→今天（今天列从 0:00 起）、今天→明天（今天列止于 24:00）、跨多天（中间列满列）。
- **R2 时长用整条**：块上时长显示条目总时长 `durationSeconds`（后端已返回，running 条目算到 now），不再用当天切片。tooltip 同步。
- **R3 跨天日属标记（方案 A）**：起止时刻落在**当前列同一天**时只显示 `HH:MM`；落在相邻 ±1 天用相对词（`昨天 HH:MM` / `明天 HH:MM`）；跨更多天的罕见情况回退显式日期（`MM-DD HH:MM`）。相对词相对于**该列的日期**（周视图中不是相对今天）。开始 / 结束各自独立判断。
- **R4 tooltip 同步**：悬停 title（`desc · 分类 · 时间范围 · 时长 · tags`）里的时间范围与日长用与块上相同的规则。
- **R5 列头合计不变**：day / week 列头的当日合计仍按裁剪切片 `clippedSeconds` 统计（23:00→01:00 在今天只贡献 1h）。仅改条目块自身的展示，不改合计语义。
- **R6 i18n**：相对词与日期格式走 i18n（zh / en 两套 locale），不硬编码中文。
- **R7 非跨天条目回归不变**：起止都在当天的条目，几何、时长、范围展示与改动前完全一致（此时 R3 两个端点都不加日属前缀）。

## Acceptance Criteria

- [ ] AC1（R1）跨天条目在其覆盖的每一天，色块几何恰好等于当天切片：昨晚 23:00→今天 01:00 的条目，在今天列画 00:00–01:00，在昨天列画 23:00–24:00，不多画。
- [ ] AC2（R2）任一天看该条目，块上与 tooltip 的时长都是整条总时长 2h（running 条目随 now 增长）。
- [ ] AC3（R3）今天列范围显示 `昨天 23:00 – 01:00`，昨天列显示 `23:00 – 明天 01:00`；非跨天端点不加日属前缀；跨 >1 天的端点回退 `MM-DD HH:MM`。
- [ ] AC4（R4）tooltip 的时间范围 / 时长与块上一致。
- [ ] AC5（R5）day / week 列头当日合计仍按切片统计，不受块上展示改动影响。
- [ ] AC6（R6）zh / en 两种语言下日属标记与日期格式正确。
- [ ] AC7（R7）非跨天条目的几何与文案与改动前一致。
- [ ] AC8 `npm run typecheck` 通过、`npm run build -w web` 通过、`npm test -w server` 不回归；并按 spec 手动验证三种跨天场景的几何/时长/日属展示。

## Out of Scope

- 不改动后端接口 / 查询 / 合计语义（后端已正确）。
- 不改 gap 插槽、拖拽创建、EntryEditor 的既有行为（它们的范围预填逻辑独立）。
- 不引入前端组件测试框架（见 Notes）。

## Notes

- 轻量级前端修复，PRD-only；技术约束直接写在此处，不另立 design.md。
- **改动位置**：`web/src/components/Timeline.tsx`（几何 + 块内文案 + tooltip），文案 key 加到 `web/src/i18n/locales/zh.ts` / `en.ts`。
- **可测纯逻辑**：裁剪计算与日属标记格式化为纯函数，放进 `web/src/format.ts`。**测试策略（已依 spec 定案）**：`.trellis/spec/frontend/quality-guidelines.md` 与 `index.md` 明确 `web/` 不设前端测试运行器，UI 行为靠运行 app 手动验证 + `npm run typecheck -w web` + `npm run build -w web`。本任务**不引入 vitest**，遵循该约定；后端测试不回归（`npm test -w server`）。
- `durationSeconds` / `clippedSeconds` 均已在 `TimeEntry` 类型与后端 DTO 中存在，前端直接用即可，无需改后端。
- 运行中条目：`stoppedAt = null` 时右端取 `nowMs`（与现有一致），范围右端显示 `…`（沿用现有），日属判断同样适用。
