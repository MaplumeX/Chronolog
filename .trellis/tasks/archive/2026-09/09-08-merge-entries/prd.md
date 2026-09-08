# 支持相邻时间条目上下合并

## Goal

用户在时间线上可以把一条已停止的时间条目与紧邻的上一条（或下一条）合并为一条，减少碎片化记录的整理成本。合并后的时间跨度覆盖两段（含中间空隙）；分类、标签、说明等属性整体保留用户所选中那一条的（整条二选一，方案 A）。

## Background（代码勘察结论）

- 条目数据：`time_entries` 表（`server/src/schema.ts:39`），字段：categoryId、description、startedAt、stoppedAt；标签通过 `entry_tags` 关联，删除条目时随 ON DELETE CASCADE 清理。
- 现有条目路由：`server/src/routes/entries.ts`（GET boundary / PATCH / POST / DELETE）。运行中条目（stoppedAt IS NULL）不可编辑、不可删除（409 CONFLICT）——这是既有不变量，合并同样遵守。
- 时间重叠校验 `checkOverlap`（`server/src/routes/entries.ts:70`）：半开区间 [start, end)，边界相接不算重叠。合并区间吞掉相邻条目，须在事务内排除两条自身后校验兜底。
- 相邻判定可参考 `listBoundary`（`server/src/entries.ts:186`）的 prev/next 查询模式（字符串序 ISO 比较，已由 #39 规范化为 .000Z 恒定格式）。
- 前端编辑入口：`web/src/components/Timeline.tsx` 点击色块弹出 `EntryEditor` popover；删除走 `ConfirmDialog` 确认弹窗的既有模式（`web/src/components/EntryEditor.tsx:170`）。
- i18n：`web/src/i18n/locales/{zh,en}.ts`；类型声明 `web/src/i18n/i18next.d.ts`。
- 测试：server `npm test -w server`（tsx --test）；web `npm test -w web`（vitest）。既有 `server/test/entries.test.ts`、`web/src/components/Timeline.test.tsx` 可参照。

## Requirements

### R1 合并入口与方向
- 在时间线条目的编辑 popover（EntryEditor，仅编辑模式非草稿）中提供「与上一条合并」「与下一条合并」操作。
- 「上一条」= 全局时间序（按 startedAt）上紧邻的前驱，跨天，不限于当前视图；「下一条」= 紧邻的后继。
- 两个方向均支持（用户确认）。
- 相邻条目不存在、或任一条目为运行中时，对应操作禁用或隐藏。

### R2 合并规则（已确认）
- 两条条目都必须已停止（与既有「运行中不可编辑」不变量一致）；运行中条目不参与合并。
- 合并后 startedAt = 两条中较早的 startedAt，stoppedAt = 两条中较晚的 stoppedAt；中间空隙一并覆盖。
- 属性（分类、标签、说明）整条二选一：用户在合并前选择保留哪一条，所选条目的分类/标签/说明原样成为合并结果的属性（方案 A，用户确认）。

### R3 后端 API
- 新增合并端点（事务）：校验两条目属同一用户（非本人条目 404）、均非运行中（409）、时间序相邻（后端以「两者之间不存在第三条条目」重判，防前端过期数据误合并，不相邻 409）。
- 保留条目（keep 条）更新时间与所选属性；另一条（被并入条）删除（entry_tags 随 CASCADE 清理）。
- 合并结果必须通过既有 checkOverlap（排除两条自身）兜底。

### R4 前端交互
- EntryEditor 中点击「与上一条/下一条合并」后弹出确认对话框：展示两条条目预览（起止时间、时长、分类、标签、说明），用户选择属性保留来源（两条二选一）后确认执行。
- 合并成功后关闭 popover 并刷新时间线数据（复用 onEntryUpdated 流程）。
- 操作进行中防重复提交；失败时错误信息展示在对话框/编辑器内可重试。

## Acceptance Criteria

- [ ] AC1：两条相邻已停止条目 A（早）、B（晚），在 B 的编辑器中选「与上一条合并」并选择保留 A 的属性，结果只剩一条：A.start → B.stop，属性 = A 的属性。
- [ ] AC2：方向相反（在 A 上「与下一条合并」，选保留 B 的属性）结果区间一致，属性 = B 的属性。
- [ ] AC3：两条之间有空隙时合并后区间连续覆盖空隙，无 OVERLAP 报错。
- [ ] AC4：任一条目为运行中时合并不可用（前端禁用/隐藏；后端 409 CONFLICT）。
- [ ] AC5：不相邻（中间隔了第三条）或跨用户条目被后端拒绝（409 / 404），错误信息可读。
- [ ] AC6：zh/en 双语文案齐全（i18next.d.ts 类型同步）。
- [ ] AC7：server 测试覆盖：双向合并、两种属性来源、跨空隙合并、运行中条目拒绝（两个方向）、不相邻拒绝、跨用户 404、被并入条的 entry_tags 清理；web 测试覆盖合并对话框流程（打开、选择来源、确认、成功刷新）。

## Out of Scope

- 跨视图特殊处理——合并语义只看全局时间相邻，与当前视图（日/周）无关。
- 多条批量合并、撤销/redo。
- 自动合并建议。
- 移动端底部 Tab 等导航改动。

## Open Questions

（无——属性粒度已定为方案 A：整条二选一。）
