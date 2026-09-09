# 技术设计：统计页四视图重构（柳比歇夫完整记录前提）

## 总体架构

`StatsPage.tsx` 保持单页面入口，内部按 view 拆分为 4 个子视图组件 + 1 个共享工具栏：

```
web/src/pages/stats/
  StatsPage.tsx        # 页面容器：view Tabs + tag/rollup 工具栏 + 数据加载 + 缓存
  DayView.tsx          # 日视图：24h 环形图 + 时段堆叠柱 + 分类构成列表
  WeekView.tsx         # 周视图：每日归一化堆叠柱 + 分类环比
  MonthView.tsx        # 月视图：分类可选热力图 + 记录纪律 KPI + 分类环比
  CustomView.tsx       # 自定义：区间选择 + 逐日堆叠趋势 + 分类/标签分布
  stats-utils.ts       # 纯函数：小时聚合 / 未记录桶 / 归一化堆叠 / 环比 / 连续天数 / 周月边界
  stats-utils.test.ts  # 上述纯函数单测
  DayRingChart.tsx     # 24h 环形图组件（recharts PieChart 极坐标变体）
```

旧 `web/src/pages/StatsPage.tsx` 删除，`App.tsx` import 指向新容器（保持 `StatsPage` 导出名与 `{tz}` props，`App.tsx` 只改 import 路径）。

## 核心领域概念（贯穿四视图）

### 未记录桶（unlogged）

- 定义：窗口内（日=24h、周=168h、月=当月天数×24h）未被任何条目覆盖的时间，运行中条目右端取 `nowMs`。
- 前端计算：`unloggedSeconds = windowSeconds - coveredSeconds`，其中 covered 由 `entries[]` 的 clip 区间求并集得出（条目可能重叠？——不会，服务端 409 拒绝重叠条目；直接求和即可，但求并集实现更防御）。
- 呈现：灰色弧段/灰段，与分类同列；颜色用 `var(--muted-foreground)` 派生（token-only）。
- tag 筛选下语义变为「未被该 tag 条目覆盖的时间」（PRD R5）。

### 覆盖度（coverage）

- 日视图中心：`coveredSeconds / 86400`，显示 `23h10m / 24h`。
- 月视图 KPI：有记录天数（covered > 0）/ 已过天数。今日已过部分按 `nowMs` 裁剪统计（“已过天数”= 今天及之前的自然日数）。

## 数据流与契约

### API：后端仅加一个返回字段

- **修正记录**（Step 3 实施时发现）：`RangeStats` 实际不含 `entries[]`（后端 `statsRange` 内部有但未返回，design 初稿误记）。修正：
  - 后端 `statsRange` 返回值增加 `entries: EntryDto[]` 字段（已有局部数据，仅加字段，不加端点、不改表）
  - DayView 改用 `/api/entries/today?date=&tagId=`（`listToday` 本就支持历史日期 + tag 筛选，且无需后端改动；rollup 在前端按 `parentId` 归并）
  - Week/Month/Custom 的逐日×分类矩阵继续用 `statsRange`（新加的 entries 字段）
- 主数据：`api.statsRange(tz, from, to, tagId, rollup)` → `RangeStats`
  - `entries[]`（新字段；startedAt/stoppedAt/categoryId/categoryName）：周视图每日×分类堆叠、月视图逐日×分类矩阵、未记录桶
  - `categories[]`：构成列表、环比基准、热力图分类排序（取占比最大者为默认）
  - `days[]`：月视图连续天数（days[i].seconds > 0 即有记录）
  - `tags[]`：自定义视图标签分布
- 环比（周/月视图）：并行第二次 `statsRange`（上周/上月窗口），前端逐分类算 delta。
- 请求缓存：`Map<cacheKey, RangeStats>`，cacheKey = `from|to|tagId|rollup`；切换视图/翻页时上一期与本期互换复用。

### 各视图查询窗口

| 视图 | 本期 from/to | 上一期（环比） | 导航单位 |
|------|--------------|----------------|----------|
| 日 | `date, date` | 无 | ±1 天 |
| 周 | 本周一..周日 | 上周一..周日 | ±1 周 |
| 月 | 1 日..月末 | 上月 1 日..月末 | ±1 月 |
| 自定义 | 用户选择 | 无 | 区间选择器 |

日期工具函数从旧 `StatsPage.tsx` 迁入 `stats-utils.ts` 并补单测（现有实现未测）。

### 轮询

仅「日视图 + 查看今天」5s 轮询（沿用 todayKey 跨午夜机制）。其余不轮询。

## 关键组件设计

### 24h 环形图（DayView 主图）

- 数据：把当日（含跨午夜裁剪到当日窗口的）条目按时段顺序生成弧段序列 `Array<{ startAngle, endAngle, color, categoryId }>`，起点 = 0 点 = 12 点钟方向，顺时针 24h；未记录时段插灰弧。
- 实现：recharts `PieChart` 半径极坐标方案——每个弧段一个 `Cell`，`startAngle={0} endAngle={360}`，按条目起止时刻折算占比（`seconds/86400 × 360°`）。不追求悬停编辑，只读 + tooltip（`HH:MM–HH:MM 分类名`）。
- 中心覆盖度用绝对定位覆盖层（现有 donut 中心写法）。
- 备选（若 recharts 极坐标按 segment 角度控制不便）：自绘 SVG `circle` + `stroke-dasharray`（每段一个 circle，`stroke-dashoffset` 累计）。实现时二选一，以 recharts 为先，不顺利再降级 SVG，两者都只消费 token 色。

### 时段分布堆叠柱（DayView）

- `hourlyByCategory(entries, dayStart, dayEnd, nowMs)`：条目按与 [h:00, h+1:00) 重叠秒数分摊到 24 桶，桶内再按分类累加；未记录 = 桶内 3600s − 已覆盖。
- recharts `BarChart` + 每分类一个 `Bar`（stackId 同值），未记录灰段也作为一个 stack 层。

### 每日归一化堆叠柱（WeekView）

- `dailyByCategory(entries, days, tz)` → `Array<{date, [categoryId]: seconds, unlogged: number}>`。
- 柱高统一归一化为 100%（每根柱 = 当天 24h 的构成条），信息在分层比例；未记录灰段在顶。
- Y 轴隐藏或显示 0–24h 刻度（实现时看效果定，默认隐藏 Y 轴 + hover tooltip 给时长）。

### 分类环比（WeekView / MonthView）

- `deltaPercent(current, previous): number | null`（previous=0 → null → "—"）。
- 列表行：`分类名 · 本期时长 · (▲x% / ▼x% / —)`；仅列本期或上期出现过该分类的行。
- 无总时长行。

### 分类可选热力图（MonthView）

- 顶部 `DropdownMenu` 选分类（列表 = 本期 categories 按时长降序；默认第一项）。
- 数据：`dailyByCategory` 的月版本 → `Map<date, seconds>`。
- 渲染：自绘 CSS grid `grid-cols-7`、周一开头；色阶 = 所选分类颜色（`paletteColor`）的透明度阶梯（0 → 4 档，按当天秒数相对当月最大值分档）；当天完全无记录（`days[i].seconds === 0`）= 特殊描边空格样式；未来日期 = 禁用灰格；hover title `M月d日 · 3h 20m`（所选分类当天时长）。
- 分类色透明度阶梯用 `color-mix(in srgb, <categoryColor> N%, transparent)`（token 派生，符合 design-tokens 规范）。

### 记录纪律 KPI（MonthView）

- 完整度：`有记录天数 / 已过天数`（已过 = min(今天, 月末)）。
- 连续记录天数：`longestStreak(days)`（当月窗口内最长连续 seconds>0）。
- 所选分类：月合计 + 日均值（÷ 当月天数）；环比上月 delta。

### 视图切换

- `Tabs`（现有组件）语义变为视图切换；各视图内自带导航条（DateNav 风格：‹ 今天 › / ‹ 本周 › / ‹ 本月 ›）。
- view 与导航状态不持久化（与现状一致）。

## 兼容与迁移

- `App.tsx` 仅改 import 路径；`StatsPage` 导出名与 props `{tz}` 不变。
- custom 校验逻辑、tag 筛选、rollup 切换原样迁移。
- i18n 新 key 全部进 `zh.ts`/`en.ts`。
- 无后端/DB 变更；回滚 = revert 前端 commit。

## 权衡记录

- **未记录桶前端算而非后端**：`entries[]` 已含全部信息；后端无需感知「完整记录」这个产品前提。
- **环形图用 recharts 极坐标、退化时 SVG 自绘**：先走库，减少自绘代码；SVG 方案控制力更强但多一份几何代码。两者都只消费 token 色，不影响验收。
- **归一化堆叠柱而非绝对时长柱**：完整记录前提下绝对时长无信息量；若未来用户记录不完整，归一化仍是安全的结构表达。
- **环比逐分类而非后端聚合**：复用 `statsRange` 任意区间能力，避免 API 膨胀；代价是每视图多一次请求（有缓存）。
- **热力图空天用描边空格而非灰色**：与「未来日期禁用灰格」「该分类当天 0 时长的浅格」三种状态区分。
