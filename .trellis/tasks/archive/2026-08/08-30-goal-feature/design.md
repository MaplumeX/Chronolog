# 目标（Goal）功能 — 技术设计

## 1. 数据模型

### 新表 `goals`（schema.ts + db.ts SCHEMA_SQL）

```sql
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  category_id TEXT REFERENCES categories(id),        -- 可空
  tag_id TEXT REFERENCES tags(id),                   -- 可空
  direction TEXT NOT NULL,          -- 'lt' | 'gt'
  hours REAL NOT NULL,              -- 目标小时数 X，> 0
  period_unit TEXT NOT NULL,        -- 'day' | 'week' | 'month'
  due_date TEXT,                    -- 'YYYY-MM-DD'（tz 相关语义，存原样）
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS goals_user_id ON goals(user_id);
```

Drizzle 定义同构。不需要迁移逻辑（新表用 `CREATE TABLE IF NOT EXISTS` 即可，
`db.ts` 现有 migrate() 只处理加列，此处无需改动）。

### 引用完整性

- `categories` / `tags` 删除路径（routes/categories.ts、routes/tags.ts）增加保护：
  存在引用该分类/标签的 goal 时返回 409 `CONFLICT`（文案"该分类已被目标引用"）。
- goal 删除为硬删除，无级联问题。

## 2. 后端 API（`server/src/routes/goals.ts` + `server/src/goals.ts`）

所有路由复用 `requireUser` 鉴权，跨用户访问一律 404。

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/goals?tz=...` | 列表 + 当前周期进度 |
| POST | `/api/goals` | 创建 |
| PATCH | `/api/goals/:id` | 更新（部分字段） |
| DELETE | `/api/goals/:id` | 删除 |

### Body/校验（zod）

```
name: trim 后 1..32 字符（与 categories 一致）
icon: 默认 🎯；1..8 个 UTF-16 code unit（emoji 安全，不校验白名单，前端网格负责选择）
categoryId: string nullable optional（须属于当前用户，否则 404）
tagId: 同上
direction: 'lt' | 'gt'
hours: number > 0，上限 1000（防溢出）
periodUnit: 'day' | 'week' | 'month'
dueDate: 'YYYY-MM-DD' 可空；校验真实日历日期（复用 time.ts 的日期校验思路）
```

### 进度计算（核心）

`GET /api/goals?tz=...` 中为每个 goal 计算：

1. **过期判定**：`dueDate < tz 本地今天` → `status: "expired"`，`currentSeconds: null`，
   不做统计。
2. **窗口计算**（time.ts 新增 `periodBounds(tz, unit, now)`）：
   - day → 复用 `todayBounds`
   - week → 复用 `weekBounds`（ISO 周，周一起）
   - month → `zonedNow.startOf("month")` 起 1 个月（月末窗口按月首+1 月推导，
     与现有 DST 安全写法同构）
3. **匹配查询**：category/Tag 条件同 R2：
   - categoryId 设置 → `timeEntries.categoryId = goal.categoryId`
   - tagId 设置 → `exists(entryTags where entryId=entries.id and tagId=goal.tagId)`
   - AND 直接用 drizzle `and()` 组合（与 `statsRange` 的 tagFilter 模式一致）
   - 加窗口重叠条件 `overlap(userId, windowStart, windowEnd)`（entries.ts 已有）
4. **累计**：对查询到的条目用 `clipSeconds(startedAt, stoppedAt, windowStart,
   windowEnd, now)` 求和（运行中条目自然按 now 截断，跨窗口条目按窗口截断）。
5. **状态输出**：
   - `progress: { currentSeconds, targetSeconds: hours*3600 }`
   - `status`: `"achieved"`（gt 且 current ≥ target；lt 且 current < target）|
     `"onTrack"`（未达成但周期未结束）| `"expired"`
   - lt 型超限时仍算 achieved 语义上不成立 → 输出 `"exceeded"`（前端显示超限红色）。
     简化：`status` 只对 expired / achieved / active 三态，前端用 direction+数值
     自行渲染"达成/超限"文案。**最终定：三态 `active | achieved | expired`。**

时区：与现有 routes 一致，tz 由 query 传入并 `requireTz` 校验。

## 3. 前端

### 页面与路由

- `Shell.tsx`：`PageId` 增加 `"goals"`，侧边栏新增菜单项（Target 图标，lucide）。
- `App.tsx`：渲染 `GoalsPage`；`HEADER_TITLE_KEYS` 增加 goals。

### GoalsPage（`web/src/pages/GoalsPage.tsx`）

- 列表：卡片/表格行显示 icon、名称、匹配条件（分类名/标签名/全部）、
  "每周 > 5h"式条件摘要、当前周期进度条（current/target）、剩余量或超限量、
  状态徽标（进行中/达成/已过期置灰）、截止日期。
- 排序：active+achieved 在前（按创建时间），expired 置灰排末尾。
- 新建/编辑：Dialog 表单（复用 ui/dialog、CategoryPicker、TagPicker 模式）：
  - 名称 Input、emoji 网格选择器（本地常量数组，~64 个常用 emoji，分主题分组）
  - 分类/标签可选下拉（复用 CategoryPicker/TagPicker 的选项逻辑）
  - direction（少于/大于 select）、hours（number input，step 0.5）、
    periodUnit（天/周/月 select）
  - 截止日期：ui/calendar 或 date input（参考 StatsPage custom range 的
    rdp 用法）
- 删除：DropdownMenu + 确认。
- 数据刷新：进入页面拉取；与 Timer 共存时不做全局轮询（页面内可手动刷新或
  简单 30s 轮询，实现时取简单方案）。

### api.ts

新增 Goal 类型与 `goals() / createGoal / updateGoal / deleteGoal` 方法。

### i18n

zh/en locales 新增 `nav.goals`、`goals.*`（表单、状态、校验文案）全部 key。

## 4. 关键取舍

- **进度实时计算而非快照**：goals 数量少（个位数~几十），每次 GET 全量计算
  成本可忽略；避免快照同步复杂度。
- **窗口只算"当前周期"**：不做历史达成记录（Out of Scope），未来可扩展
  `GET /api/goals/:id/history`。
- **emoji 存字符串**：不做白名单校验，前端选择器引导；后端仅限长度，宽容旧数据。
- **dueDate 存 'YYYY-MM-DD'**：过期判定在查询时按请求 tz 解释，无时区歧义
  （与"本地今天"比较）。

## 5. 兼容与回滚

- 纯新增表 + 新增路由 + 新增页面，不改既有表结构；回滚 = revert commit，
  SQLite 中残留 goals 表无副作用（旧代码不读它）。
- categories/tags 删除保护是行为变更（原来可直接删，现在被 goal 引用时 409），
  影响面小且有明确文案。
