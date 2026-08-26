# 标签功能：实施计划

## 实施清单（按序）

### 1. 后端：schema 与数据库
- [ ] `server/src/schema.ts`：新增 `tags`、`entryTags` 表定义（含唯一索引、级联外键）
- [ ] `server/src/db.ts`：`SCHEMA_SQL` 追加两张表的 `CREATE TABLE IF NOT EXISTS` + 索引
- [ ] 验证：`npm run typecheck -w server`；启动后 `sqlite3` 检查表存在

### 2. 后端：标签 CRUD
- [ ] 新增 `server/src/routes/tags.ts`：GET（含 entryCount）、POST、PATCH、DELETE（直接删，级联解除关联）
- [ ] `server/src/app.ts`：注册 `registerTagRoutes`
- [ ] 测试 `server/test/tags.test.ts`：CRUD、重名 409、删除级联、用户隔离 404

### 3. 后端：计时与查询带标签
- [ ] `server/src/entries.ts`：`EntryDto` 加 `tags`；`getEntry`/`getRunningEntry`/`listToday` 批量挂载 tags
- [ ] `server/src/routes/timer.ts`：`startBody` 加 `tagIds`（可选、去重、归属校验）；`startOnce` 事务内写 `entry_tags`
- [ ] `server/src/entries.ts`：`statsToday` 支持可选 `tagId` 过滤（EXISTS 子查询；归属校验 404）
- [ ] `server/src/routes/today.ts`：`/api/stats/today` 透传 `tagId` 查询参数
- [ ] 测试：`timer.test.ts` 扩展（start 带标签、current 返回 tags）、`today.test.ts` 扩展（today 返回 tags、stats 按 tagId 过滤、非法 tagId 404）

### 4. 前端：API 客户端与类型
- [ ] `web/src/api.ts`：`Tag` 类型、`TimeEntry.tags`、`api.tags()`/`createTag`/`renameTag`/`deleteTag`、`api.todayStats(tz, tagId?)`

### 5. 前端：计时器标签选择
- [ ] 新增 `web/src/components/TagPicker.tsx`（多选 DropdownMenu，Check 标记）
- [ ] `TimerBar.tsx`：加 `tagPicker` slot；running 时只读标签徽章
- [ ] `TimerPage.tsx`：加载标签列表、选中态、start 传 `tagIds`、running 展示

### 6. 前端：时间线标签展示
- [ ] `Timeline.tsx`：`full` 档标签徽章行；tooltip 追加标签名

### 7. 前端：统计筛选
- [ ] `StatsPage.tsx`：标签筛选下拉（全部 + 各标签），选中后带 `tagId` 请求，保持 5s 轮询

### 8. 前端：标签管理页
- [ ] 新增 `web/src/pages/TagsPage.tsx`（Table + 行内二次点击删除确认）
- [ ] `Shell.tsx`：`PageId` 加 `"tags"`、导航项（lucide `Tag`）
- [ ] `App.tsx`：页面分支

### 9. 前端：i18n
- [ ] `web/src/i18n/locales/zh.ts` / `en.ts`：`nav.tags`、`tags.*`、`timer.selectTags`、`stats.allTags` 等键

### 10. 收尾验证
- [ ] `npm run typecheck`（server + web）
- [ ] `npm test -w server`
- [ ] `npm run build -w web`
- [ ] 手动验证：dev 环境跑通 计时带标签 → 时间线徽章 → 统计筛选 → 标签管理

## 验证命令

```bash
npm run typecheck -w server
npm test -w server
npm run typecheck -w web
npm run build -w web
```

## 风险文件 / 回滚点

- `server/src/db.ts`（SCHEMA_SQL）与 `server/src/schema.ts` 必须同步改，漏一处则查询报错
- `server/src/entries.ts`（EntryDto 变更影响 timer/today/stats 三处返回）
- `web/src/api.ts`（TimeEntry 类型变更影响所有消费方）
- 每步完成后跑 typecheck；后端步骤 2/3 完成后跑 `npm test -w server`

## 检查清单（check 阶段）

- [ ] 新表在 `SCHEMA_SQL` 与 `schema.ts` 中一致
- [ ] 标签 CRUD 全链路（含重名 409、删除级联、隔离 404）
- [ ] start 带 tagIds 后 current/today 返回 tags
- [ ] stats 按 tagId 过滤正确、非法 tagId 404
- [ ] 前端四界面（计时/时间线/统计/管理页）功能与 i18n 完整
- [ ] typecheck / test / build 全绿
