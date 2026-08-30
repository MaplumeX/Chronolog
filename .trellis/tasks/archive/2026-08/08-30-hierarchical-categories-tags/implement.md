# 执行计划：分类与标签两级层级

按顺序执行；每步末尾跑对应验证命令。S1–S4 为后端，S5–S7 为前端，S8 全量验证。

## S1 数据层：schema + 迁移

- [ ] `server/src/schema.ts`：`categories` / `tags` 新增 `parentId: text("parent_id")`；新增 `categories(user_id, parent_id)` / `tags(user_id, parent_id)` 索引。
- [ ] `server/src/db.ts`：SCHEMA_SQL 建表语句加 `parent_id TEXT`；`migrate()` 对旧库 `ALTER TABLE ... ADD COLUMN parent_id TEXT` 并 `DROP INDEX IF EXISTS categories_user_id_name` / `tags_user_id_name`（新库不再建这两个索引）。
- 验证：`cd server && npm test -- --run`（现有测试应全绿，证明迁移不破坏现状）

## S2 分类 API 层级支持（routes/categories.ts）

- [ ] `GET` 返回 `parentId`。
- [ ] `POST` 支持 `parentId`（校验：存在+同用户；parent 必须顶层；同父重名 409）。
- [ ] `PATCH` 支持 `parentId`（额外校验：自己不能当自己的 parent；已有子节点的节点不能变为子级）。
- [ ] `DELETE` 级联：检查所有子分类无 entries / goal 引用后，事务内先删子级再删父级。
- 验证：`cd server && npm test -- --run`（旧测试）+ 新增测试见 S4

## S3 标签 API + 统计 rollup

- [ ] `routes/tags.ts`：同 S2 的层级逻辑（DELETE 无 entries 约束，只需 goal 检查 + 级联子标签）。
- [ ] `entries.ts`：`statsToday` / `statsRange` 支持 `rollup` 参数（子分类秒数并入父分类桶）。
- [ ] `routes/today.ts`：`/api/stats/today`、`/api/stats/range` 读取 `rollup` query。
- 验证：`cd server && npm test -- --run`

## S4 后端测试

- [ ] `server/test/categories.test.ts` 扩展：建子级、三级拒绝、同父重名 409、跨父重名 OK、级联删除（成功 case + entry/goal 拦截 case）、PATCH 改 parent。
- [ ] `server/test/tags.test.ts` 扩展：同上标签版。
- [ ] `server/test/stats-range.test.ts` / `today.test.ts` 扩展：rollup=true 时子分类并入父分类、rollup 缺省不变。
- 验证：`cd server && npm test -- --run` 全绿

## S5 前端 API 与类型

- [ ] `web/src/api.ts`：`Category`/`Tag` 加 `parentId`；create/update 传 `parentId`；stats 调用带 `rollup`。
- 验证：`cd web && npm run build`

## S6 管理页与选择器

- [ ] `CategoriesPage.tsx` / `TagsPage.tsx`：两级树渲染、每行「添加子级」、编辑 popover 支持改父级、删除父级 confirm 提示级联。
- [ ] `CategoryPicker.tsx` / `TagPicker.tsx`：分组 + 子级缩进展示。
- [ ] i18n 文案（zh/en）补充。
- 验证：`cd web && npm run build && npm run lint`

## S7 统计页切换

- [ ] `StatsPage.tsx`：分类统计区加「独立/汇总」切换，切换后带 `rollup` 重新拉取 today/range。
- 验证：`cd web && npm run build && npm run lint`

## S8 全量验证 + 收尾

- [ ] `cd server && npm test -- --run`
- [ ] `cd web && npm run build && npm run lint`
- [ ] 手动 smoke（docker compose 起本地环境，建两级分类/标签，跑计时，切统计模式）— 可选，如环境不便则以测试为准
- [ ] 进入 Phase 3：spec 更新 + commit（trellis-finish-work）

## 回滚点

- 每步独立可回滚；S1 迁移为加列+删索引，回滚代码即恢复（列留存无害）。
- 数据风险最高的操作是 S2/S3 的级联删除逻辑——必须先有测试覆盖再合入。

## Review gates

- S4 完成后（后端整体）跑一轮 trellis-check。
- S8 全量完成后跑最终 trellis-check（full scope）。
