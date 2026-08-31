# PRD: 时间条目删除

## 背景

当前时间条目只能创建和编辑（PATCH），没有任何删除入口：

- 后端 `server/src/routes/entries.ts` 只有 `GET /api/entries/boundary`、`PATCH /api/entries/:id`、`POST /api/entries`，没有 `DELETE /api/entries/:id`。
- 前端 `web/src/components/EntryEditor.tsx`（编辑 popover）只有「取消 / 保存」按钮。
- `web/src/api.ts` 没有 `deleteEntry`。

## 需求

### R1 后端删除接口

新增 `DELETE /api/entries/:id`，行为与 `PATCH` 一致的所有权校验：

- 仅条目所有者（`userId` 匹配）可删除；条目不存在或不属于当前用户 → 404 `NOT_FOUND`。
- 运行中的条目（`stoppedAt IS NULL`）不可删除 → 409 `CONFLICT`（与编辑限制一致："运行中的条目不可编辑"；删除场景返回中文文案 "运行中的条目不可删除"）。
- 删除成功返回 `{ ok: true }`。
- `entry_tags` 关联由 schema 的 `ON DELETE CASCADE` 自动清理，无需手动删除。

### R2 前端 API 客户端

`web/src/api.ts` 新增 `deleteEntry(id)`，与 `deleteCategory` / `deleteTag` / `deleteGoal` 模式一致。

### R3 前端编辑 popover 删除入口

`EntryEditor.tsx` 在**编辑模式**（`entry` prop 存在，非 draft/gap 新建模式）下，按钮区左侧增加「删除」按钮：

- 样式：destructive 变体或红色文字，与现有 destructive 操作（tags/goals 删除）视觉一致。
- 交互：项目无确认 dialog 惯例（Tags/Goals 用内联确认 `confirmDelete`），EntryEditor 空间较小，采用与 tags/goals 相同的**内联两步确认**：第一次点击变成「确认删除？」，再点执行删除；或点其它区域/取消恢复。简单起见可用 window.confirm 的替代——遵循项目内联确认模式。
- 删除成功后：关闭 popover + 刷新时间线（复用 `onSaved()` 回调，或新增 `onDeleted()` 回调——由实现者按 Timeline.tsx 的现状选择改动最小的方案，`onSaved` 语义已包含"关闭 + onEntryUpdated"，可直接复用）。
- 删除失败显示错误（i18n key `entry.deleteFailed`）。
- 删除中禁用按钮（复用 `saving` 状态或新增 `deleting` 状态）。

### R4 i18n

zh / en 各新增：

- `entry.delete`：删除 / Delete
- `entry.confirmDelete`：确认删除？/ Confirm delete?
- `entry.deleteFailed`：删除失败 / Failed to delete

## 约束

- 遵循现有代码风格：后端 zod 校验、`parseBody`、`AppError`、事务内操作；前端 shadcn/ui Button、i18n 全量走 `t()`。
- 不改动 overlap 校验、timer 路由（运行中计时器的停止/切换逻辑不受影响）。
- `ON DELETE CASCADE` 已存在于 `entryTags.entryId` 引用，无需迁移。

## 验收标准

1. `DELETE /api/entries/:id` 对已停止条目返回 `{ ok: true }` 且数据库中条目与 `entry_tags` 行均消失。
2. 删除他人条目 → 404；删除不存在的条目 → 404。
3. 删除运行中条目 → 409。
4. 前端时间线上点击一个已停止条目，popover 中出现「删除」按钮，两步确认后条目从时间线消失（today/week 视图数据刷新）。
5. 新建（draft/gap）模式下不出现删除按钮。
6. `cd server && npm test` 全部通过（含新增的删除用例）。
7. zh/en 文案无缺失 key。

## 测试建议（server/test/entries.test.ts 追加）

- 删除已停止条目 → 200 `{ ok: true }`，再 GET 相关 today 列表不含该条目；entry_tags 行被级联清理。
- 删除运行中条目 → 409 CONFLICT。
- 删除不存在的 id → 404；删除其他用户的条目 → 404。
