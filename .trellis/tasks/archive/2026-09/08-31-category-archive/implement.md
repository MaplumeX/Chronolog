# 执行计划：分类归档功能

## 顺序清单

### 阶段 A：后端数据层（server）

- [x] A1. `schema.ts`：categories 加 `archivedAt` 列；`timeEntries.categoryId` 去掉 notNull。
- [x] A2. `db.ts`：SCHEMA_SQL 同步 + `migrate()` 幂等迁移（ALTER 加列 + time_entries 表重建使其可空，PRAGMA legacy_alter_table 流程）。
- [x] A3. `server/test/migration.test.ts`：新增"老库升级后 category_id 可空、索引与 FK 完整、数据无损"用例。
- 验证：`npm run typecheck -w server && npm test -w server`

### 阶段 B：后端路由与查询（server）

- [x] B1. `entries.ts`：innerJoin → leftJoin + coalesce 兜底名；`EntryDto.categoryId: string | null`；`rollupCategories` 适配 null 桶；导出 `UNCATEGORIZED_NAME`。
- [x] B2. `routes/categories.ts`：列表返回 `archivedAt`；POST archive / unarchive 路由（级联逻辑）；删除路径放宽（time_entries / goals 置 NULL）；`requireValidParent` 拒绝归档父级。
- [x] B3. `routes/entries.ts` / `routes/timer.ts`：checkCategory / startOnce 拒绝归档分类（409），编辑/改绑时 categoryId 未变化则放行。
- [x] B4. `server/test/categories.test.ts`：归档/取消归档/级联/删除放宽全行为用例；`entries.test.ts`/`timer.test.ts`：归档分类不可选、未分类条目（含运行中）查询正常、统计含未分类桶。
- 验证：`npm run typecheck -w server && npm test -w server`

### 阶段 C：前端（web）

- [x] C1. `api.ts`：类型放宽 + archive/unarchive 方法。
- [x] C2. `hierarchy.ts`：`filterActive()` 导出 + 单元测试。
- [x] C3. `CategoryPicker` 调用方（use-timer-controller / EntryEditor）接入 filterActive；未分类条目显示兜底。
- [x] C4. `HierarchicalListCard`：归档分区渲染（折叠区、置灰、归档/取消归档按钮、ConfirmDialog 复用）；移除 deleteDisabled 分类页传参。
- [x] C5. `CategoriesPage`：接 archive/unarchive API；i18n zh/en 新增/删除 key。
- [x] C6. web 测试：HierarchicalListCard 归档分区交互、filterActive 单测。
- 验证：`npm run typecheck -w web && npm test -w web`

### 阶段 D：收尾

- [ ] D1. 全仓验证：`npm run typecheck && npm test`。
- [ ] D2. 最后一轮 full-scope check（trellis-check）。

## 审查门 / 回滚点

- 每阶段结束跑对应验证命令，失败不进入下一阶段。
- 阶段 A 的表重建迁移是高风险点，migration.test 必须先行通过。
- 回滚点 = 各阶段独立可提交（但按仓库惯例单 PR 单 commit 收尾）。

## 测试命令

- server：`npm run typecheck -w server && npm test -w server`
- web：`npm run typecheck -w web && npm test -w web`
- 全仓：`npm run typecheck && npm test`
