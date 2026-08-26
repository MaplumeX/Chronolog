# 标签功能：技术设计

## 架构与边界

- **数据层**：新增 `tags` 表与 `entry_tags` 关联表（多对多）。无 drizzle-kit 迁移，`SCHEMA_SQL`（`server/src/db.ts`）与 `schema.ts` 双文件同步，`CREATE TABLE IF NOT EXISTS` 平滑升级。
- **后端**：新增 `server/src/routes/tags.ts`（CRUD）；扩展 `entries.ts`（EntryDto 带 tags、统计按标签筛选）；扩展 `timer.ts`（start 接受 tagIds）。
- **前端**：新增 `TagPicker` 组件（多选下拉）、`TagsPage` 管理页；扩展 `Timeline`（标签徽章）、`StatsPage`（标签筛选）、`TimerBar`（标签选择/展示）、`Shell`（导航项）。

## 数据模型

```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_name ON tags(user_id, name);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS entry_tags_tag_id ON entry_tags(tag_id);
```

- `tags` 与 `categories` 同构：user-scoped、`(user_id, name)` 唯一、重名 → 409。
- `entry_tags` 复合主键提供 entry→tags 查询索引；`tag_id` 索引支撑统计筛选与删除级联。
- 删除标签：直接 `DELETE FROM tags`，`entry_tags` 经 `ON DELETE CASCADE` 自动清理（用户已确认此策略，与分类的"占用即 409"不同）。

## API 契约

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/tags` | yes | `{ tags: [{ id, name, entryCount }] }` |
| POST | `/api/tags` | yes | `{ name }`；重名 → 409 `CONFLICT` |
| PATCH | `/api/tags/:id` | yes | `{ name }`；重名 → 409 |
| DELETE | `/api/tags/:id` | yes | 直接删除，级联解除关联 |
| POST | `/api/timer/start` | yes | body 增加 `tagIds?: string[]`（可选，默认无标签） |
| GET | `/api/stats/today?tz=&tagId=` | yes | `tagId` 可选；不属于当前用户 → 404 |

- 标签名校验与分类一致：trim 后 min 1 / max 32（zod）。
- `tagIds` 校验：数组元素去重；每个 id 必须属于当前用户（事务内校验，否则 404 `NOT_FOUND`）。
- `EntryDto` 增加 `tags: { id: string; name: string }[]`（按 startedAt 排序或按名称排序，取稳定顺序）。`web/src/api.ts` 的 `TimeEntry` 同步加 `tags`。

## 数据流

- **start**：`startOnce` 事务内：校验分类归属（现有）→ 校验 tagIds 归属 → 停旧启新（现有）→ 插入 entry → 批量插入 `entry_tags`。
- **listToday / getEntry / getRunningEntry**：查询 entries 后，按 entry id 批量查 `entry_tags ⋈ tags`，分组挂到各 entry 的 `tags` 字段。
- **statsToday**：`tagId` 存在时，用 `EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = time_entries.id AND tag_id = ?)` 过滤 `listToday` 的条目，再走现有聚合。`tagId` 归属校验失败 → 404。

## 前端设计

- **TagPicker**：shadcn `DropdownMenu` + 每项勾选标记（`Check` 图标，选中项高亮），多选；与 `CategoryPicker` 同风格。不引入 checkbox 组件。
- **TimerBar**：增加 `tagPicker` slot（与 `categoryPicker` 并列）；running 时显示只读标签徽章（替代选择器）。
- **Timeline**：`full` 档在 `block-meta` 下方显示标签徽章行（小圆点 + 名称，`categoryColor(tag.name)` 哈希配色，与分类一致不存库）；`compact`/`mini` 档不显示（空间不足），tooltip title 中追加标签名。
- **StatsPage**：标题行下方加标签筛选下拉（"全部标签" + 各标签），选中后请求 `/api/stats/today?tagId=`；保持 5s 轮询。
- **TagsPage**：仿 `CategoriesPage`（shadcn `Table`），含使用次数列；删除用**行内二次点击确认**（点击"删除"→ 变为"确认删除？"，再点执行），不引入 alert-dialog 组件。
- **Shell**：`PageId` 加 `"tags"`，导航项图标用 lucide `Tag`（分类已用 `Tags`）；`App.tsx` 加页面分支。
- **i18n**：zh/en 同步新增 `nav.tags`、`tags.*`、`timer.selectTags`、`stats.allTags` 等键。

## 兼容与迁移

- 新表 `CREATE TABLE IF NOT EXISTS`，旧库启动时自动建表，无破坏性变更。
- 服务端 `EntryDto` 总是返回 `tags`（新库空数组），前端类型同步，无版本兼容问题。
- 统计 API 的 `tagId` 为可选参数，旧客户端调用不受影响。

## 权衡

| 决策 | 选择 | 理由 |
|------|------|------|
| 标签删除策略 | 直接删除 + 级联解除关联 | 用户已确认；标签是轻量标记 |
| 计时器标签输入 | 多选下拉（从已有标签选） | 用户已确认；与现有 UI 一致，避免"输入即建"的垃圾标签问题 |
| 标签颜色 | 复用 `categoryColor(name)` 哈希，不存库 | 与分类规范一致（"Do not store colors in the database"） |
| 删除确认 | 行内二次点击 | 不引入新组件，保持轻量 |
| 统计筛选归属校验 | 非法 tagId → 404 | 与项目"跨用户资源 404"规范一致 |

## 回滚

- 后端与前端同仓同步发布；新表对旧代码无害（旧代码不读新表）。
- 回滚顺序：前端回退（去掉标签 UI）→ 后端保留新表与 API（无害）或一并回退。
- 无数据迁移脚本，无破坏性 ALTER，回滚不涉及数据修复。
