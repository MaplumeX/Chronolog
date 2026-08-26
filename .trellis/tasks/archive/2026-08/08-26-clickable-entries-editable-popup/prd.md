# 时间线条目可点击编辑（popover）

## Goal

时间线（Timeline）上的时间条目色块目前只能 hover 看提示（`title`），不可交互。用户希望点击条目后，在条目附近弹出 popover，显示该条目的信息，并允许编辑。

## Confirmed Facts（代码证据）

- 时间线组件：`web/src/components/Timeline.tsx`，`DayColumn` 渲染 `timeline-block` 色块，day/week 两种视图共用；目前只有 `title` 提示，无点击交互。
- 条目数据结构：`TimeEntry`（`web/src/api.ts`）= id、categoryId/categoryName、description、startedAt、stoppedAt、durationSeconds、clippedSeconds、tags[]。
- 后端目前**没有**编辑条目的接口：`server/src/routes/` 只有 auth/categories/timer/today/tags；`timeEntries` 表（`server/src/schema.ts`）字段为 id、userId、categoryId、description、startedAt、stoppedAt；`entryTags` 为多对多关联表。
- 已有可复用模式：`CategoryPicker`/`TagPicker`（DropdownMenu 多选）、`ui/` 下有 button/input/label/dropdown-menu/tabs 等 shadcn 组件，**没有** popover 组件（需新增或自实现）。
- 前端 i18n：`web/src/i18n/locales/zh.ts` + `en.ts`，所有文案需双语。
- 后端测试：`server/test/*.test.ts` 用 `node:test` + `app.inject`，`createTestApp` 支持注入 `now`。
- 运行中条目：`stoppedAt` 为 null，且存在唯一索引保证每用户最多一条运行中条目。

## Requirements

- R1：点击时间线（day/week 视图）中**已停止**的条目色块，在条目附近弹出 popover。
- R2：popover 显示条目信息：描述、分类、标签、起止时间、时长。
- R3：popover 内可编辑：描述、分类、标签、起止时间（用户已确认支持编辑起止时间）。
- R4：运行中（未停止）的条目不可点击编辑（用户已确认）。
- R5：保存后刷新时间线数据，popover 关闭。
- R6：所有新增文案支持中/英双语。
- R7：编辑起止时间后，条目可能移出当前视图（day/week），刷新后 popover 关闭。
- R8：编辑后的时间区间不得与用户的其他条目（含运行中条目）重叠（用户已确认）；边界相接（前一条结束 == 后一条开始）不算重叠。

## Acceptance Criteria

- [ ] AC1：day 视图点击已停止条目，popover 出现在条目附近，显示描述/分类/标签/起止时间/时长。
- [ ] AC2：week 视图点击已停止条目，同样弹出 popover。
- [ ] AC3：运行中条目点击无反应（不可编辑）。
- [ ] AC4：在 popover 中修改描述/分类/标签并保存，时间线立即反映更新（含分类颜色、标签、描述）。
- [ ] AC5：在 popover 中修改起止时间并保存，时间线立即反映更新（时长、位置变化）；编辑后条目移出当前视图时 popover 关闭。
- [ ] AC6：后端提供编辑接口，仅允许编辑本人条目；分类/标签不存在时返回 404；描述超长返回 400；结束时间不晚于开始时间返回 400；运行中条目不可编辑；与其它条目（含运行中条目）时间重叠返回 409。
- [ ] AC7：中英文文案齐全。

## Out of Scope

- 删除条目。
- 运行中条目的编辑。
- 通过编辑把已停止条目变为运行中（stoppedAt 必须保持非 null）。
