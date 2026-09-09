# timer 时间戳截断到整秒，消除幽灵占位毫秒重叠

## Goal

计时器（start/stop）写入 `time_entries` 的 `startedAt` / `stoppedAt` 统一截断到整秒（毫秒归零），使幽灵占位（gap slot）创建条目时不再因毫秒精度差异被服务端正确地判为重叠（409 OVERLAP）。

## Background（根因链路，已核实）

1. `timer/start`、`timer/stop` 用 `deps.now().toISOString()` 真实时钟写入，带毫秒（如 `10:00:30.123Z`）：
   - `server/src/routes/timer.ts:158`（start 的 `nowIso`）
   - `server/src/routes/timer.ts:182`（stop 的 `nowIso`，同时用于旧段 `stoppedAt` 与无间隙新段 `startedAt`）
2. 前端 `computeGaps`（`web/src/timeline-gaps.ts`）的 gap 边界取自邻条目 `stoppedAt`/`startedAt`，`handleGapClick`（`web/src/components/Timeline.tsx:614`）原样写入 gapDraft。
3. `EntryEditor.tsx` 的 `toLocalInput` 只保留到秒，保存时毫秒被截掉（`10:00:30.123Z` → `10:00:30.000Z`）。
4. 服务端 `checkOverlap`（`server/src/routes/entries.ts:81`）按半开区间字符串序比较，前条目 `stoppedAt=10:00:30.123Z` > 新条目 `startedAt=10:00:30.000Z` → 重叠 123ms → 409。

即：**毫秒只进不出**——写入带毫秒，编辑器读出时截断，必然差 <1s 撞上邻条。源头对齐到整秒后，全链路（DB、gap、编辑器、overlap 判定）都在秒精度上自洽。

## Requirements

- R1：`/api/timer/start` 写入的 `startedAt`（新段）与被自动停止旧段的 `stoppedAt` 均为整秒（毫秒 = 0）。
- R2：`/api/timer/stop` 写入的 `stoppedAt`，以及无间隙模式下新段的 `startedAt`，均为整秒；同一次 stop 事务内「旧段 stoppedAt = 新段 startedAt」的无间隙不变量保持（继续共用同一个截断后的 nowIso）。
- R3：截断方式为向下取整（floor 到秒），不产生未来时刻。
- R4：不改动其它 `deps.now().toISOString()` 调用点（categories/tags/goals/tokens 的 createdAt、auth 的 lastUsedAt/session 过期等）——它们不参与条目时间轴与重叠判定。

## Acceptance Criteria

- [ ] AC1：注入 now = `10:00:30.500Z` 时调用 `POST /api/timer/start`，返回条目 `startedAt === "…T10:00:30.000Z"`；若之前有运行中条目，其 `stoppedAt` 同样为 `.000Z`。
- [ ] AC2：注入 now 带毫秒时调用 `POST /api/timer/stop`，返回条目 `stoppedAt` 为 `.000Z`；开启无间隙模式（continuousTiming）时新段 `startedAt` 与旧段 `stoppedAt` 相等且均为 `.000Z`。
- [ ] AC3（回归，复现幽灵占位场景）：用计时器产生相邻两条整秒条目后，`POST /api/entries` 创建一条「起点 = 前条目 stoppedAt」的条目 → 201（边界相接不算重叠），不再 409。
- [ ] AC4：现有测试全绿（`npm test` in `server/`，`npm test` in `web/`）。

## Out of Scope

- **前端安全取整（方案 B）**：用户明确不做。
- **历史数据迁移**：库中已有的带毫秒条目不清洗，其幽灵占位在边界上仍可能触发 409；新数据不再产生该问题。用户知情并接受。
- `deps.now()` 的其它消费方（时长计算 `durationSeconds`、session 过期等）继续使用真实时刻，不受影响。

## Technical Notes

- 修改点集中在 `server/src/routes/timer.ts` 两处 `nowIso` 的生成：`Math.floor(now.getTime() / 1000) * 1000` 后 `toISOString()`（可提一个小 helper）。
- 服务端其余入口（`POST /api/entries`、`PATCH /api/entries/:id`）的 ISO 已由 zod `isoInstant` 规范化为 `.000Z`，无需改动。
- 测试放在 `server/test/`（现有 timer/today 测试风格：注入 Clock + `t.app.inject`）。
