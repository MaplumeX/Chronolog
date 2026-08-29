# Implement: 重构统计页面

## 执行顺序

### Step 1 后端：时间工具 + 聚合端点

- [ ] `server/src/time.ts`：新增 `rangeDayBounds(tz, from, to)` —— 逐日窗口数组，luxon `plus({ days: i })` 推导（DST 安全），`from > to` 或超 92 天由调用方校验
- [ ] `server/src/entries.ts`：新增 `statsRange(db, userId, tz, from, to, now, tagId?)`
  - 校验：`requireDate` 语义解析 from/to；`from > to` → 400 `VALIDATION`；天数 > 92 → 400
  - 一次 overlap 查询 + tagFilter；days/categories/tags 三路聚合（见 design.md）
- [ ] `server/src/routes/today.ts`：注册 `GET /api/stats/range`（复用现有 query 解析辅助）
- [ ] `server/test/stats-range.test.ts`：
  - 跨午夜条目按天拆分正确（复用 today.test.ts 的上海时区 fixture 手法）
  - 运行中条目按 now 裁剪
  - 多标签条目计入每个标签；无标签桶存在
  - 0 天补齐（范围内空白天也输出）
  - `from > to` / 超 92 天 / 无效日期 → 400
  - 外来 tagId → 404（对齐 statsToday 语义）

验证：`npm test -w server`

### Step 2 前端：API client + recharts 依赖

- [ ] `web/package.json`：`npm install recharts@^3`
- [ ] `web/src/api.ts`：新增 `RangeStats` 类型 + `statsRange()`；保留 `todayStats`

验证：`npm typecheck -w web`

### Step 3 前端：StatsPage 重构

- [ ] 范围档位状态 + 日期推导（today/week/month 从 `browserTz()` + now 推导；custom 用 `react-day-picker` 选起止）
- [ ] 摘要卡（范围总时长）+ 趋势 `BarChart` + 分类 `PieChart`(donut) + 分类条形列表（加百分比）+ 标签条形列表（含无标签桶）
- [ ] 轮询：仅 today 档 5s；其余档位参数变化时拉取
- [ ] 空状态 + 错误态 + 加载态
- [ ] i18n zh/en 全部新 key
- [ ] 样式遵循 design-tokens（分类 `categoryColor`、主题色用 CSS 变量）

验证：`npm typecheck -w web && npm run build -w web`

### Step 4 收尾

- [ ] 手动 smoke：切换四档位 + 标签筛选 + 空范围
- [ ] 全量 `npm test` + `npm run typecheck`（两端）

## 风险与回滚点

- 高风险文件：`web/src/pages/StatsPage.tsx`（整页重写）——回滚即 revert 单文件
- `server/src/time.ts` 是共享模块，只新增不改旧函数，风险低
- recharts 与 React 19.2 组合偶有渲染问题报告（issue #6857），Step 3 完成 smoke 时重点确认图表实际渲染

## 验证命令

```bash
npm test -w server
npm typecheck -w web && npm run build -w web
```
