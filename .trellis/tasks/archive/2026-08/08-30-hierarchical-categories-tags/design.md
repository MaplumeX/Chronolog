# 技术设计：分类与标签两级层级

## 总体思路

- `categories` / `tags` 各加可空 `parent_id` 列（SQLite `ALTER TABLE ADD COLUMN`），指向同表同用户顶层节点。
- 深度 ≤ 2 与同父重名约束在 **API 层校验**（SQLite 部分唯一索引 + 外键自引用虽可表达，但跨层校验/错误信息更清楚，且与现有 unique violation 处理一致）。
- 统计聚合（独立/汇总）在**服务端**做：`/api/stats/today` 与 `/api/stats/range` 新增 `rollup` 查询参数，返回前将子分类秒数并入父分类。默认 `rollup` 缺省 = 独立模式，保证既有调用方行为不变。
- 前端管理页改为两级树展示，选择器按「父级 + 缩进子级」分组渲染。

## 数据模型

### schema.ts (drizzle)

```ts
// categories / tags 均新增：
parentId: text("parent_id"), // 不加 DB 级外键（自引用 FK + 级联删除语义由应用层处理）
```

不建 DB 外键的原因：SQLite 自引用 FK + `ON DELETE CASCADE` 也可以，但级联删除子级还必须先处理时间记录引用（categories 删除前要求无 entries），应用层显式删除顺序更可控、错误信息更明确。加索引：`categories(user_id, parent_id)`、`tags(user_id, parent_id)`。

### db.ts 迁移

- `SCHEMA_SQL`：新库建表语句加入 `parent_id TEXT`；删除旧唯一索引 `categories_user_id_name` / `tags_user_id_name`，改为不建表级唯一索引（唯一性由应用层校验：同用户同父下重名检查）。
- `migrate()`：对已有库 `ALTER TABLE categories ADD COLUMN parent_id TEXT`（tags 同理），然后 `DROP INDEX IF EXISTS categories_user_id_name` / `tags_user_id_name`。

> 注：唯一约束从 `(user_id, name)` 放宽为「同父下唯一」，SQLite 无法用单一索引同时表达「顶层唯一 + 同父唯一」（NULL 不参与唯一比较），因此放到应用层。现有 `(user_id, name)` 唯一索引必须删除，否则跨父重名会撞索引。

## API 设计

### 分类 / 标签 CRUD（routes/categories.ts, routes/tags.ts）

- `GET /api/categories` / `GET /api/tags`：返回项新增 `parentId: string | null`。
- `POST`：body 新增可选 `parentId?: string | null`。校验：
  - parentId 存在且属于当前用户（否则 404 / VALIDATION）；
  - parentId 指向的节点是顶层（无 parent）（否则 409「层级最多两级」）；
  - 同父下同名不存在（否则 409 CONFLICT，沿用现有错误文案）。
- `PATCH /api/:id`：body 新增可选 `parentId?: string | null`（null = 提升为顶层）。校验同上，另加：
  - 不能把自己设为自己的 parent（或 parent 的 parent，后者自然被「parent 必须是顶层」拦截——自己是子级时它必有 parent，即非顶层，会被拒）；
  - 改名后同父下重名检查；
  - **若节点已有子节点，不允许再挂到父级下**（它必须是顶层）。
- `DELETE /api/:id`：
  - 分类删除前置条件维持现状（无时间记录、无 goal 引用），并追加：其**所有子分类**也必须满足同样条件（无记录、无 goal 引用）；满足则在同一事务中删除子分类再删父级（级联，符合 PRD「级联删除」语义，但引用完整性仍受保护）。
  - 标签删除：现有逻辑已天然级联（`entry_tags` 有 `ON DELETE CASCADE`），追加子标签的 goal 引用检查后同样一并删除。

### 统计聚合（entries.ts）

- `statsToday` / `statsRange` 签名新增可选 `rollup?: boolean`。
- 实现方式：先按现有逻辑得到 per-category 聚合结果，再查一次 `categories` 表得到 `id -> parentId` 映射，若 `rollup` 为真，将子分类的秒数并入其 parent 桶（parent 桶名用父分类名），子分类条目消失。
- tags 聚合**不做层级汇总**（PRD 的切换需求仅针对分类统计；标签层级只影响组织/选择）。— 如后续需要可再扩展。
- today.ts 路由层：`/api/stats/today` 与 `/api/stats/range` 读取 `rollup` query（`"true"`/`"1"` 为真）。

## 前端设计

### 类型与 API（api.ts）

- `Category` / `Tag` 类型新增 `parentId: string | null`。
- `api.createCategory / updateCategory / createTag / updateTag` 支持传 `parentId`。
- stats 调用支持 `rollup` 参数。

### 管理页（CategoriesPage / TagsPage）

- 列表按两级树渲染：顶层行 + 缩进的子级行。
- 新建：保留顶部「新建顶层」输入框；每行增加「添加子级」按钮（弹 popover/复用 NameColorEditPopover 的模式输入名字）。
- 编辑：现有 NameColorEditPopover 扩展支持「所属父级」选择（无 / 各顶层节点），保存时传 `parentId`。
- 删除：父级行删除按钮提示将级联删除 N 个子级（confirm 文案），子级也需满足无记录约束时才可用。

### 选择器（CategoryPicker / TagPicker）

- DropdownMenuItem 按「顶层分组 + 缩进子项」渲染（子项加缩进 padding 与可视层级标记），所有节点可选。

### 统计页（StatsPage）

- 分类统计区域顶部加切换控件（例如两个 toggle 按钮 / SegmentedControl：「独立」/「汇总」），切换时带 `rollup` 参数重新请求（today 与 range 各自生效）。
- 默认「独立」，与现状一致。

## 兼容性与回滚

- 迁移仅做加列 + 删索引，幂等且不丢数据；回滚 = 恢复代码（列留存无害）。
- API 响应是加法变更（新增 `parentId` 字段、新增可选 query 参数），不破坏既有消费方。
- 若删除唯一索引后有存量重名（不可能出现——原索引保证了唯一），无兼容问题。

## 测试策略

- server test：categories/tags 层级 CRUD（建子级、三级拒绝、同父重名 409、跨父重名成功）、级联删除（含 goal/entry 引用拦截）、stats rollup（today + range 数字正确性）、迁移回归（老库结构升级）。
- web：`npm run build` + lint；手动验证 UI 树形展示。
