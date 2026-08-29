# Design: 重构统计页面

## 总体架构

单一 API 端点 + 前端页面重构，无 schema 变更。

```
StatsPage (web)
  └─ GET /api/stats/range?tz=&from=&to=&tagId=
       └─ statsRange (server/src/entries.ts)   ← 新增聚合函数
            └─ 复用 overlap 查询 + clipSeconds 逐日裁剪
```

## 后端

### 新端点 `GET /api/stats/range`

- 位置：`server/src/routes/today.ts`（与 `/api/stats/today` 同文件，统计资源同源）
- 参数：`tz`（必填，`requireTz`）、`from`/`to`（`YYYY-MM-DD`，tz 本地日期，两端含端点即闭区间；`requireDate` 校验）、`tagId`（可选）
- 档位映射（前端负责）：
  - 今日 → `from=to=today`
  - 本周 → `from=周一, to=周日`（ISO 周，`weekBounds`）
  - 本月 → `from=月初, to=月末`
  - 自定义 → 用户选择
- 约束：`from ≤ to`，否则 400 `VALIDATION`；区间长度上限 **92 天**（约三个月，防超大区间拖垮聚合；超出报 400）
- 响应：
  ```ts
  {
    tz: string;
    rangeStart: string; rangeEnd: string;      // UTC ISO-Z，[start, end)
    days: { date: string; seconds: number }[]; // 每日总秒数，date 为 "YYYY-MM-DD"（tz 本地），含 0 天
    categories: { categoryId: string; categoryName: string; seconds: number }[]; // 降序
    tags: { tagId: string | null; tagName: string | null; seconds: number }[];   // null = 无标签桶，降序
    totalSeconds: number;
  }
  ```

### 聚合实现 `statsRange`（`server/src/entries.ts`）

- 用 `parseDateParam` 解析 `from`/`to` 得到首日/末日锚点；逐日窗口 = `from.startOf("day")` 起，`to + 1 天` 止
- **逐日窗口生成遵循 DST 规则**：用 luxon `plus({ days: i })` 逐日推导（与 `weekDayBoundsFrom` 同构，抽出通用的 `rangeDayBounds` 辅助函数放入 `server/src/time.ts`），不得用 `start + i * 86400000`
- 一次 `overlap` 查询取范围内所有条目（含 tagFilter 子查询，复用 `listToday` 的写法），然后：
  - **days**：对每个日窗口 `clipSeconds` 求和（0 天也输出）
  - **categories**：整个 range 的 clip 秒数按分类聚合（range 级 clip = 首日 dayStart 到末日 dayEnd 的窗口）
  - **tags**：`attachTags` 取每条 entry 的标签；多标签条目在每个标签下计入其 clipped 秒；无任何标签的秒数进 `tagId: null` 桶
- 运行中条目：`clipSeconds` 已按 `now` 裁剪，语义自然继承
- `date` 输出统一为 tz 本地 `YYYY-MM-DD`（用 luxon `toISODate()`）

### `/api/stats/today` 处置

保留不动（零风险），前端不再调用。后续可在别的任务清理。

## 前端

### 依赖

- 新增 `recharts`（^3.x，peer deps 支持 React 19）
- 其余不变

### `web/src/api.ts`

- 新增 `RangeStats` DTO 类型（与后端响应对齐）
- 新增 `statsRange(tz, from, to, tagId?)`，`todayStats` 保留但不再被页面使用

### `web/src/pages/StatsPage.tsx` 重构

页面结构（自上而下）：

1. **控制区**：范围档位切换（`Tabs` 或分段按钮：今日/本周/本月/自定义）+ 自定义时的日期区间选择（复用 `react-day-picker`，项目已有）+ 标签筛选下拉（保留现有）
2. **摘要卡**：总时长（现有卡片扩展，显示当前范围）
3. **趋势图**：recharts `BarChart`，X 轴日期、Y 轴小时，柱色用主题色；悬停 tooltip 显示当日时长（`formatDuration`）
4. **分类占比**：recharts `PieChart`（donut）+ 图例；下方保留现有横向条形列表并加百分比列
5. **标签统计**：纯 CSS 条形列表（复用现有条形样式），「无标签」用 muted 色 + i18n key `stats.noTag`

### 数据流与刷新

- 档位状态：`range: { kind: "today" | "week" | "month" | "custom", from?: string, to?: string }`
- `from`/`to` 由前端从 `browserTz()` + 当前时间推导（`today` → 今天；`week` → 本 ISO 周一/周日；`month` → 本月首/末日；custom → 用户选择）
- 查询参数变化时 fetch；**保留 5s 轮询但仅当 `kind === "today"`**（历史范围数据不变，无轮询意义）
- 加载中/错误状态与现有一致（错误条 + i18n fallback）

### 样式与主题

- recharts 配色：分类用 `categoryColor(name)`；趋势柱用 CSS 变量（如 `var(--primary)`）以适配双主题——recharts 接受 CSS 变量字符串作为 fill
- 图表容器高度固定（如趋势图 `h-56`），`ResponsiveContainer` 自适应宽度
- 遵循现有设计规范：间距分组、`border-b`、无浮夸卡片投影

### i18n

新增 key（zh/en 同步）：`stats.range.today/week/month/custom`、`stats.dailyTrend`、`stats.byTag`、`stats.noTag`、`stats.customRange.*`（起止选择、校验提示）、`stats.emptyRange`（空状态）等。

## 取舍记录

- **单一 range 端点 vs 每档位一个端点**：单端点 + 前端推导日期，后端逻辑集中、测试面小；档位是纯 UI 概念
- **92 天上限**：防止全表级聚合；前端自定义选择同样受此限制并给出提示
- **tags 多计入语义**：一个 entry 有 2 个标签会在两个标签桶各计全额 clipped 秒，因此 tags 总和可能大于 totalSeconds——在 UI 上不显示 tags 总和即可避免误导
- **today 轮询保留**：统计页今日数据与计时器联动，5s 刷新维持「实时感」；其余档位切换时才拉取

## 回滚

- 前端整体重构单页面，回滚 = revert 该页面 + `api.ts` 新增段
- 后端为纯新增端点，回滚无风险
