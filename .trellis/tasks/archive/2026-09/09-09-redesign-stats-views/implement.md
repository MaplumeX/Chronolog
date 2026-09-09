# 实施计划：统计页四视图重构

## 执行顺序（每步一个可验证单元）

### Step 1：stats-utils 纯函数 + 单测
- [ ] 新建 `web/src/pages/stats/stats-utils.ts`：迁移旧 `StatsPage.tsx` 纯日历函数（toDate/shiftDate/toWeekStart/todayIn/countDays/toLocalDate/fromLocalDate），新增：
  - `monthBounds(date)`（当月 1 日..月末，纯日历）
  - `hourlyByCategory(entries, dayStart, dayEnd, nowMs, tz)`（24 桶 × 分类 + 未记录）
  - `dailyByCategory(entries, days, tz)`（逐日 × 分类矩阵 + 未记录列）
  - `unloggedSeconds(windowSeconds, coveredSeconds)`
  - `deltaPercent(current, previous)`（previous=0 → null）
  - `longestStreak(days)`（当月窗口）
  - `coverageDays(days, todayDate, monthEnd)`（有记录天数 / 已过天数）
- [ ] 新建 `stats-utils.test.ts`：覆盖小时分摊（跨小时条目、运行中裁剪）、跨午夜条目当日裁剪、未记录桶、环比（上期 0 → null）、streak（全空/连续/断续/单日/今天中断）、完整度（未来日期不计入分母）、月边界（闰年 2 月、跨年 12→1）、周对齐（周一）。
- [ ] 验证：`npm test -w web -- stats-utils` 通过。

### Step 2：页面骨架 + 容器改造
- [ ] 新建 `web/src/pages/stats/StatsPage.tsx`（容器）：view Tabs（day/week/month/custom）、tag 筛选、rollup 切换、`Map<cacheKey, RangeStats>` 请求缓存、5s 轮询（仅日视图+今天，todayKey 跨午夜机制原样迁移）。
- [ ] `App.tsx` import 改到新路径；删除旧 `web/src/pages/StatsPage.tsx`。
- [ ] 4 个子视图占位渲染，保证骨架可跑。
- [ ] 验证：`npm run dev` 手动切换 4 视图；`npm run typecheck -w web` 通过。

### Step 3：DayView
- [ ] 日期导航（‹ 今天 ›，DateNav 风格）。
- [ ] `DayRingChart`（24h 环形图）：分类弧段 + 未记录灰弧 + 中心覆盖度；recharts 极坐标优先，不顺降级 SVG。
- [ ] 时段分布 24 桶分类堆叠柱 + 分类构成列表（含未记录灰桶行）。
- [ ] 今日轮询实时刷新；历史日期不轮询。
- [ ] 验证：手动查看今天/昨天；环形图弧段角度与条目时刻对应。

### Step 4：WeekView
- [ ] 周导航（‹ 本周 ›）。
- [ ] 每日归一化分类堆叠柱（7 柱，未记录灰段在顶）。
- [ ] 分类环比列表（并行第二请求 + 缓存；▲/▼/—；无总时长行）。
- [ ] 验证：手动翻上周；tag 筛选下环比一致生效。

### Step 5：MonthView
- [ ] 月导航（‹ 本月 ›）。
- [ ] 分类下拉选择器（默认占比最大分类）+ CSS grid 热力图（分类色透明度阶梯、空天描边、未来禁用、hover 明细）。
- [ ] KPI 行：完整度 / 连续记录天数 / 所选分类合计与日均 / 所选分类环比上月。
- [ ] 验证：空月、当月（未来禁用）、2 月边界；切换分类热力图重绘。

### Step 6：CustomView
- [ ] 迁移现有 range Calendar 选择器 + 校验（from≤to / ≤92 天 / 完整）。
- [ ] 逐日分类堆叠趋势图（复用 `dailyByCategory`）+ 分类/标签分布列表迁移。
- [ ] 验证：与重构前 custom 档行为一致。

### Step 7：i18n + 收尾
- [ ] `zh.ts`/`en.ts` 补全所有新 key（视图名、导航、KPI、覆盖度、未记录、环比、空态）。
- [ ] 全量验证：`npm run typecheck -w web && npm test -w web && npm run build -w web`。
- [ ] 旧代码清理：无旧 StatsPage 残留引用。

## 验证命令

```bash
npm run typecheck -w web
npm test -w web
npm run build -w web
```

## 风险与回滚点

- 每步独立 commit，可按步 revert。
- 风险文件：`App.tsx`（import 路径）、旧 `StatsPage.tsx` 删除（Step 2 一次完成切换）。
- 环形图为新图表形态：Step 1 单测先行 + Step 3 保留 SVG 降级路径，降低实现风险。

## start 前检查

- [x] prd.md 收敛（无未决问题）
- [x] design.md / implement.md 就绪
- [x] implement.jsonl / check.jsonl 已填真实 spec 条目
