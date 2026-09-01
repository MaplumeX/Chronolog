# 技术设计：分类归档功能

## 1. 数据模型与迁移

### schema.ts

- `categories` 表新增 `archivedAt: text("archived_at")`（NULL = 活动；ISO 字符串 = 归档时间）。
- `timeEntries.categoryId` 改为可空：`.references(() => categories.id)` 不变，去掉 `.notNull()`，类型 `string | null`。

### db.ts 迁移

- SCHEMA_SQL 中两处同步（categories 建列含 `archived_at TEXT`；time_entries 的 `category_id` 定义改为可空——`CREATE TABLE IF NOT EXISTS` 对已有库无影响，仅新库生效）。
- `migrate()` 幂等步骤：
  - `table_info(categories)` 无 `archived_at` → `ALTER TABLE categories ADD COLUMN archived_at TEXT`。
  - `table_info(time_entries)` 的 `category_id` 列 `notnull` 为 1 → 重建表使其可空（SQLite 不能直接去 NOT NULL）：
    1. `PRAGMA foreign_keys = OFF`（事务外）
    2. 在事务中：按新定义 `CREATE TABLE time_entries_new` → `INSERT INTO time_entries_new SELECT ... FROM time_entries` → `DROP TABLE time_entries` → `ALTER TABLE time_entries_new RENAME TO time_entries` → 重建 `time_entries_user_started`、`time_entries_one_running` 索引及 entry_tags 外键（`entry_tags` 引用 time_entries，SQLite 默认 `PRAGMA legacy_alter_table=off` 时 DROP+RENAME 会使 entry_tags 的 FK 指向悬空，需 `PRAGMA legacy_alter_table = ON` 或重建 entry_tags——采用 **`PRAGMA legacy_alter_table = ON` 包裹 RENAME**，这是最小且 SQLite 官方推荐的 12-step 流程变体）。
    3. `PRAGMA foreign_keys = ON`（恢复）
  - 老库中已删除分类遗留的孤儿 category_id 理论上不存在（旧约束阻止删除有记录的分类），不做数据清洗。
- 迁移测试（migration.test.ts 模式）：构造含 `NOT NULL category_id` 的老库 → 启动 → 验证列可空、索引存在、数据完整。

## 2. 后端路由（routes/categories.ts）

### 列表 `GET /api/categories`

- 响应每项新增 `archivedAt: string | null`。

### 归档 `POST /api/categories/:id/archive`

- 校验存在 + 归属；设 `archivedAt = now()`。
- 若为顶层节点：所有 `parentId = id` 的子分类一并设置 `archivedAt`（整体归档，含已归档子级幂等刷新时间戳——统一刷新保持简单）。
- 归档子分类：仅自身。
- 事务内完成；返回更新后的完整列表项。

### 取消归档 `POST /api/categories/:id/unarchive`

- 沿 parentId 链向上，把所有 `archivedAt != null` 的祖先置 NULL（级联恢复祖先链）；目标自身置 NULL。
- 不触碰兄弟/子孙（除目标自身）。
- 返回更新后的完整列表项。

### 删除 `DELETE /api/categories/:id`（放宽）

删除事务内，对 `[id, ...children]` 每个目标：
- `UPDATE time_entries SET category_id = NULL WHERE category_id = target`（运行中条目同样被覆盖 → 变未分类，计时器继续）。
- `UPDATE goals SET category_id = NULL WHERE category_id = target`。
- 删除分类行。
- 前置校验（无时间记录、无 goal 引用）全部移除；但保留“目标必须属于当前用户”检查（getOwnCategory）。

### 创建/更新约束

- `requireValidParent` 追加：父级 `archivedAt` 非空 → 409 "归档分类不能作为父级"。
- PATCH 移动到归档父级下同样被拦截（requireValidParent 复用即可）。
- `assertNameAvailable` 不变（归档与活动共享命名空间）。

### `GET /api/tags` 等其他路由

- 不涉及。

## 3. 条目/计时器路由（entries.ts / timer.ts）

- `checkCategory` 与 `startOnce` 的分类校验追加：`isNull(categories.archivedAt)` → 归档分类返回 409 "分类已归档"（新建/改绑不允许选归档分类；编辑已归档条目保持原分类不受影响，因为 PATCH 总是显式传 categoryId，而传归档分类 id 会被拒——语义符合 PRD："切换到其他分类后不能切回"）。
  - 注意：编辑器打开归档分类的既有条目时不修改分类直接保存会触发 409——需要允许“值未变化”的情况：`checkCategory` 在 `categoryId === existing.categoryId` 时跳过归档检查（entries upsert 路径传入原值比较）。timer.ts 的 `updateCurrent` 同理。

### entries.ts（核心模块）查询修复

`timeEntries.categoryId` 可空后，所有 `innerJoin(categories)` 改为 `leftJoin`，`categoryName` 兜底：

```ts
categoryName: sql<string>`coalesce(${categories.name}, '未分类')`
categoryId: timeEntries.categoryId  // 类型变 string | null
```

- `EntryDto.categoryId: string | null`；`categoryName: string`（"未分类"常量导出 `UNCATEGORIZED_NAME`，与 i18n 前端文案对应——服务端文案本就中文硬编码，沿用现状）。
- `rollupCategories`：`parentOf` 查询按非空 categoryId 工作；未分类（null）自成一组，categoryId 为 null 的桶输出 `categoryId: null`。
- 统计输出类型 `categories: { categoryId: string | null; ... }` 同步放宽。

## 4. 前端（web）

### api.ts

- `Category` 增加 `archivedAt: string | null`。
- `TimeEntry.categoryId: string | null`。
- 新增 `archiveCategory(id)` / `unarchiveCategory(id)`。
- 统计响应类型 `categoryId: string | null`。

### CategoryPicker.tsx

- 调用方（`use-timer-controller.tsx`、`EntryEditor.tsx`）传入的 categories 先过滤：父级归档 → 整个子树隐藏；子级归档仅隐藏自身。
  - 过滤逻辑放 `hierarchy.ts` 新增导出 `filterActive(categories)`：活动父 + 其活动子；无父级归档子级保留（父级活动、子归档 → 只显示父）。

### EntryEditor.tsx

- `selectedCategory` 可能为 undefined（未分类条目）：编辑保存时 `categoryId` 传 null 合法化——后端 upsert 仍要求非空？**决策：后端 updateBody.categoryId 保持必填非空**（编辑器对未分类条目强制选择分类，简单直接）；未分类条目显示"未分类"占位。
  - `pickerLabel` 处理：`entry.categoryName` 已由后端 coalesce 为"未分类"，显示无碍。
  - `isDraft` 校验 `categoryId === ""` 保持不变。

### use-timer-controller.tsx

- running 条目可能 categoryId 为 null：`pickerLabel` 用 `running?.categoryName ?? ...` 已兜底；`updateCurrent` 不变。

### CategoriesPage.tsx + HierarchicalListCard.tsx

- 传入全部 categories（含归档）；卡片内按 `archivedAt` 分区渲染：
  - 活动区（现有渲染）在前；归档区在后，带分隔标题行「已归档 (n)」+ 可折叠（默认折叠）。
  - 归档行视觉：`text-muted-foreground` + 归档标记（小 Archive 图标，lucide）。
  - 归档行操作：编辑（改名/换色）保留、移动父级保留（但归档父级不可选——后端约束 + 前端过滤 options）、删除保留（现可用，因约束放宽）、新增「取消归档」按钮；活动行新增「归档」按钮。
  - 归档确认弹窗复用 ConfirmDialog（非破坏性，文案不同）；归档父级时描述提示将连带归档 n 个子分类。
- `deleteDisabled`（entryCount > 0 禁删）由分类页传入的逻辑**移除**（约束已放宽）；后端 409 文案 `categories.deleteBlockedTitle` 同步删除。
- 归档行不显示「添加子分类」入口（父级归档后子分类操作意义有限，且简化状态）。

### StatsPage / Timeline

- `categoryId` 可能为 null：色点用 `paletteColor(null, name)` 兜底，名称直接用后端返回的"未分类"，无需改动逻辑（`categoryColorOf` 已 `?? null`）。

### i18n（zh.ts / en.ts）

新增 key：`categories.archive`、`categories.unarchive`、`categories.archived`、`categories.archivedCount`、`categories.archiveConfirmTitle`、`categories.archiveCascadeDescription`、`categories.unarchiveConfirmTitle`、`categories.unarchiveParentCascadeDescription`（取消归档会连带恢复父级链提示）、`common.uncategorized` 等；删除 `categories.deleteBlockedTitle`。

## 5. 数据流与兼容

- API 变更全部向后兼容：新增字段/新增路由；`categoryId` 可空是放宽，旧客户端不传 null 即不受影响。
- 归档时间取 `deps.now()`，与 createdAt 一致的 ISO 格式。
- 前端“未分类”文案：后端返回 `categoryName = "未分类"`，前端不二次翻译（与服务端现有中文硬编码策略一致）。

## 6. 风险与回滚

- **time_entries 表重建迁移**是最高风险点（FK/索引重建）。缓解：12-step 事务流程 + 专门的迁移测试（老库含运行中条目、entry_tags 关联、goals 引用）。
- 回滚：新列 `archived_at` 对旧代码无害（多列被忽略）；`category_id` 可空对旧代码 SELECT 无害但旧删除路径会恢复 409 行为——可接受。
