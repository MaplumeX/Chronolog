# 目标（Goal）功能 — 执行计划

## 前置阅读（sub-agent 上下文）

- `.trellis/spec/` 下 backend / frontend 层规范
- 参考实现：`server/src/routes/categories.ts`（CRUD 模式）、`server/src/entries.ts`
  （statsRange 的 tagFilter/clipSeconds/overlap）、`web/src/pages/CategoriesPage.tsx`
  （列表页模式）、`web/src/pages/StatsPage.tsx`（tz/日期处理）

## 执行清单（按序）

### 阶段 1：后端

- [ ] 1.1 `server/src/schema.ts`：新增 `goals` 表定义（见 design.md §1）
- [ ] 1.2 `server/src/db.ts`：SCHEMA_SQL 增加 goals 建表 + 索引
- [ ] 1.3 `server/src/time.ts`：新增 `periodBounds(tz, unit, now)`
      （day/week 复用现有函数，month 新增，DST 安全）
- [ ] 1.4 `server/src/goals.ts`：进度计算模块（匹配查询 + clipSeconds 求和 +
      三态 status），导出 `listGoalsWithProgress(db, userId, tz, now)`
- [ ] 1.5 `server/src/routes/goals.ts`：GET/POST/PATCH/DELETE，zod 校验，
      越权 404，categoryId/tagId 归属校验
- [ ] 1.6 `server/src/app.ts`：注册 goals 路由
- [ ] 1.7 `server/src/routes/categories.ts` / `tags.ts`：删除保护
      （被 goal 引用时 409）

### 阶段 2：后端测试

- [ ] 2.1 `server/test/goals.test.ts`：CRUD、校验（AC7）、AND 语义（AC3）、
      进度与窗口截断（AC2，含跨午夜/跨周条目）、达成判定（AC4）、
      过期（AC5）、引用保护（AC6）、越权 404
- [ ] 2.2 跑 `npm test -w server` 通过

### 阶段 3：前端

- [ ] 3.1 `web/src/api.ts`：Goal 类型 + 四个 API 方法
- [ ] 3.2 `web/src/i18n/locales/zh.ts` / `en.ts`：全部 goals.* key（AC8）
- [ ] 3.3 `web/src/pages/GoalsPage.tsx`：列表 + 进度展示 + 排序（active/achieved
      在前，expired 置灰末尾）
- [ ] 3.4 GoalEditorDialog（或内联）：新建/编辑表单，emoji 网格常量选择器，
      分类/标签下拉，方向/小时/周期/截止日期（AC1）
- [ ] 3.5 `Shell.tsx` + `App.tsx`：PageId "goals"、侧边栏菜单、路由渲染
- [ ] 3.6 删除确认流程（AC6）

### 阶段 4：验证

- [ ] 4.1 `npm run typecheck`（server + web）
- [ ] 4.2 `npm test -w server`
- [ ] 4.3 手动/浏览器冒烟：创建目标→计时→查看进度变化→过期目标展示
      （sub-agent 无浏览器时以接口测试代替，主会话可补冒烟）

## 验证命令

```bash
npm run typecheck
npm test -w server
```

## 风险与回滚点

- 风险文件：`db.ts`（SCHEMA_SQL，语法错误影响启动）、`categories.ts`/`tags.ts`
  （删除保护改动既有行为）
- 回滚：整分支 revert 即可，goals 表残留无副作用（见 design.md §5）
- 每阶段完成后 typecheck + test 是回滚检查点

## task.py start 前检查

- [ ] prd.md / design.md / implement.md 完成
- [ ] implement.jsonl / check.jsonl 已填真实条目
- [ ] 用户已批准最终规划摘要
