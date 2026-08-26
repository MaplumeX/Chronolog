# 计时页当天/本周视图切换 — 执行计划

## 实施顺序

### 1. 后端：周边界与周数据

- [ ] `server/src/time.ts`：新增 `weekBounds(tz, now)`（luxon `startOf("week")`，周一 00:00 起，7 天）
- [ ] `server/src/entries.ts`：新增 `listWeek(db, userId, tzRaw, now)`（一次查询周窗口，按 7 天分组裁剪，输出 `{ tz, weekStart, weekEnd, days }`）
- [ ] `server/src/routes/today.ts`：新增 `GET /api/entries/week?tz=` 路由
- [ ] `server/test/week.test.ts`：新增测试（tz 校验、周边界、跨天裁剪、运行中条目、用户隔离）

验证：`npm test -w server`、`npm run typecheck -w server`

### 2. 前端：API 与格式化

- [ ] `web/src/api.ts`：新增 `WeekEntries` 类型与 `api.weekEntries(tz)`
- [ ] `web/src/format.ts`：新增 `formatWeekLabel`、`formatWeekdayLabel`

### 3. 前端：Timeline 组件改造

- [ ] `web/src/components/Timeline.tsx`：抽 `DayColumn` 子组件（复用现有 ruler/track/block/now-line 逻辑）
- [ ] `Timeline` 支持 `mode: "day" | "week"`；week 模式渲染 7 列并排 + 周头部 + 列头
- [ ] 周视图横向滚动、垂直定位到当前时间

### 4. 前端：TimerPage 集成

- [ ] `web/src/pages/TimerPage.tsx`：新增 `view` state 与 `week` state
- [ ] 头部 shadcn Tabs 切换控件（当天/本周）
- [ ] 切换按需加载；开始/停止后刷新当前视图
- [ ] 周总时长 = 7 天 `totalClippedSeconds` 求和

### 5. i18n

- [ ] `web/src/i18n/locales/zh.ts` / `en.ts`：新增 `timeline.viewDay`、`timeline.viewWeek`、`timeline.weekEmpty`（如需）等文案

## 验证命令

```bash
npm test -w server
npm run typecheck
npm run build
```

## 审查门

- [ ] 当天视图零回归（默认模式、现有行为不变）
- [ ] 周视图 7 列、边界正确、跨天裁剪正确
- [ ] 所有文案 i18n 化
- [ ] 无 DB schema / 环境变量变更

## 回滚点

- 后端与前端均为纯增量（新增端点/类型/组件），无破坏性变更；可单独回滚任一层
