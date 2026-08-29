# 重构统计页面：时间范围、趋势、占比与标签统计

## Goal

重构 `web/src/pages/StatsPage.tsx`，把「仅今日分类条形图」升级为可回顾的多维统计页：

1. 时间范围切换：今日 / 本周 / 本月 / 自定义日期区间
2. 按天趋势图（recharts）
3. 分类占比可视化（环形图 + 百分比）
4. 标签维度统计（含「无标签」桶）

对比功能（原功能 5）经用户决策移除，不在本次范围。

## Background / 现状

- 现有页面（`web/src/pages/StatsPage.tsx`）：仅今日、按分类横向条形 + 总时长、标签下拉筛选、5s 轮询。
- 后端仅有 `/api/stats/today`（`server/src/routes/today.ts:44` → `statsToday`，`server/src/entries.ts`），逻辑是按 clippedSeconds 聚合分类。
- 已有可复用的时间窗口工具：`weekBounds` / `weekDayBounds` / `clipSeconds` / `dateDayBounds`（`server/src/time.ts`），`listWeek` 已实现按天分桶（周一至周日）。
- 前端无图表库；经调研 recharts 3.x 官方支持 React 19（peer deps 含 ^19.0.0），选定 recharts。
- `categoryColor(name)` 调色板（`web/src/format.ts`）用于分类着色，双主题适配。
- i18n：zh/en 双语言，所有 UI 文案走 i18n key。

## Requirements

### R1 时间范围切换
- 档位：今日 / 本周 / 本月 / 自定义日期区间（起止日选择）
- 切换档位后所有统计区块（趋势、占比、标签）随所选范围联动
- 保留标签筛选，作用于所有区块
- 自定义区间需校验：起 ≤ 止，区间上限待设计定（防过大范围拖垮查询）

### R2 按天趋势图
- 所选范围内每日总时长的柱状图（recharts）
- 所有档位统一按天聚合；无数据的日子显示为 0
- 悬停显示当日时长

### R3 分类占比可视化
- 所选范围内分类时长占比环形图（recharts Pie）+ 现有条形列表
- 列表显示时长与占比百分比

### R4 标签维度统计
- 所选范围内每个标签的累计时长条形列表（纯 CSS 条形即可）
- 「无标签」条目归入「无标签」桶；多标签条目在每个标签下都计入

## Acceptance Criteria

- [ ] 切换今日/本周/本月/自定义区间，各区块数据正确联动
- [ ] 跨午夜的记录按 clipped 秒数正确归属到各天（复用现有 clip 语义）
- [ ] 运行中（未停止）条目在统计中按 now 裁剪计入
- [ ] 分类占比之和 = 总时长，百分比显示正确
- [ ] 标签统计含「无标签」桶，多标签条目在每个标签下都计入
- [ ] 空状态：范围内无任何记录时展示引导文案而非空白
- [ ] zh/en 双语言完整
- [ ] typecheck 通过；后端新增聚合逻辑有测试

## Out of Scope

- 与上期对比（用户决策移除）
- 热力图年视图、CSV 导出、周报摘要、目标设定
- 数据库 schema 变更
- 现有 `/api/stats/today` 的移除或改签（前端不再使用后可留在原处或由设计决定）

## Key Decisions

- 图表库选 recharts 3.x（React 19 官方支持）
- 时间范围四档位含自定义区间
- 对比功能本次不做
