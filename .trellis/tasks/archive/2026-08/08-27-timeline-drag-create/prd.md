# Timeline drag-to-create entry

## Goal

在时间轴（Timeline）空白区域按下并拖动一段范围，松开后即以该起止时间创建新条目，并打开编辑器补全类别、描述、标签。对齐 Toggl Timeline 的 "drag to create" 交互，让补录历史时间段比"点按钮 + 手动填时间"更直接。

## Background / Confirmed Facts（代码勘察）

- `web/src/components/Timeline.tsx`：`DayColumn` 为 day / week 两种模式共用，纵向 24h，支持 60/30/15/5 分钟四档缩放（`SCALES`，每档 40px/tick）。条目色块点击弹出 `Popover` + `EntryEditor`。
- 后端目前**没有** `POST /api/entries`：条目只能经 `POST /api/timer/start` / `stop` 创建（`server/src/routes/timer.ts`）。
- `PATCH /api/entries/:id`（`server/src/routes/entries.ts`）含完整的校验链：分类归属、标签归属、stoppedAt > startedAt、半开区间 [start, end) 重叠检测（OVERLAP 409）、运行中条目不可编辑（409）。这些校验逻辑可提取复用。
- `EntryEditor`（`web/src/components/EntryEditor.tsx`）当前只接受已有 `TimeEntry`，保存调用 `api.updateEntry`。
- `web/src/api.ts` 的 `TimeEntry` 类型含 `id/categoryId/description/startedAt/stoppedAt/tags`。

## Requirements

- R1 拖动创建：在时间轴 track 空白处 pointerdown 并拖动，实时渲染半透明预览块，松开后以按下的时间点为 `startedAt`、松开位置为 `stoppedAt` 创建条目草稿。
- R2 松开后打开编辑器（EntryEditor 复用/扩展），用户确认后保存才入库；取消则不产生任何数据。
- R3 day 与 week 两种模式均支持；week 模式拖动发生在对应日期列上，创建的条目归属该列日期。
- R4 误触保护：按下后几乎未移动（点击）不触发创建；拖动 snap 后不足一个最小网格时，按一个最小网格时长创建（如 60 档下拖出 3 分钟 → 创建 15 分钟条目）。
- R5 后端提供创建接口（复用 PATCH 的校验链），返回创建后的 `TimeEntry`。
- R6 创建时间可早于/晚于当前时间（补录历史、预约性条目），受该日 [dayStart, dayEnd) 约束。
- R7 与现有色块点击编辑交互不冲突：从色块上开始的按下仍走原有的选中/编辑流程。
- R8 拖动起止时间 snap 到刻度网格（随缩放档位）：60 档 → 15 分钟、30 档 → 10 分钟、15 档 → 5 分钟、5 档 → 1 分钟（决策：方案 A，Toggl 式 snap）。
- R9 编辑器打开时默认无类别，用户必须选择类别才能保存（决策：不记住上次类别）。

## Acceptance Criteria

- [ ] AC1 在 day 模式空白处从 10:00 拖到 11:30，松开后出现编辑器且预填 10:00–11:30；保存后时间轴出现该条目，时长正确。
- [ ] AC2 week 模式下在任意日期列拖动，创建的条目归属该列日期。
- [ ] AC3 拖动过程中预览块实时跟随，并显示起止时间。
- [ ] AC4 拖动范围与现有条目重叠时，保存被拒绝并显示 OVERLAP 错误（与编辑条目行为一致）。
- [ ] AC5 单纯点击空白处（未拖动）不创建条目，也不打断现有交互。
- [ ] AC6 取消编辑器（关闭/ESC）后不产生任何条目。
- [ ] AC7 拖动创建在缩放 60/30/15/5 各档位下像素→时间换算正确，且起止时间对齐对应网格（60 档 15 分钟、30 档 10 分钟、15 档 5 分钟、5 档 1 分钟）。
- [ ] AC8 现有条目色块的点击编辑行为不受影响。
- [ ] AC9 后端创建接口通过分类/标签归属、时间合法性、重叠校验的单测覆盖。
- [ ] AC10 新建编辑器打开时类别为空，未选类别时无法保存。

## Out of Scope

- 拖动调整已有条目的边缘以改变起止时间（drag-to-resize）。
- 拖动移动已有条目（drag-to-move）。
- 触屏/移动端专用优化（以 pointer events 基本可用为准）。

## Key Decisions

- snap 行为：方案 A（Toggl 式 snap 到刻度网格），且不足一个最小网格时按一个网格时长创建。
- 默认类别：无默认，必须选择。