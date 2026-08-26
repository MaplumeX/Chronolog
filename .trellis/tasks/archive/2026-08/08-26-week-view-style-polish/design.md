# Design: 周视图样式优化

## 现状

`web/src/components/Timeline.tsx`：

- `DayColumn` 内部固定渲染 `timeline-ruler`（56px 宽，25 个小时刻度）+ `timeline-track`（`left: 56px`，含 grid 线 / blocks / now-line / empty-hint）。
- week 模式 = 7 个 `DayColumn` 并排（`flex min-w-[180px] flex-1`），每列自带 ruler → 每列重复显示 06:00/07:00/08:00。
- 列头 = `formatWeekdayLabel`（仅星期文案）+ 当日总时长。
- 空天渲染 `timeline.weekEmpty`（"无记录"）。

## 目标结构

```
week 容器 (flex)
├── 共享 ruler（56px，25 个小时刻度，仅一次）
└── 7 天列（flex-1）
    ├── 列头：日期数字（大、粗）+ 星期（次要）；当天高亮
    └── DayColumn（showRuler=false）
        └── timeline-track（left:0，内部 grid 线贯穿本列）
```

## 关键决策

1. **ruler 抽取**：`DayColumn` 增加 `showRuler?: boolean`（默认 `true`）。`false` 时不渲染 `timeline-ruler`，且 track 使用 `.timeline-track--full { left: 0 }`。week 模式外层 flex 容器第一项放共享 ruler（复用 `.timeline-ruler` 样式），其后 7 列 `showRuler={false}`。
   - 网格线仍由每列内部 `.timeline-grid` 渲染（`left:0; right:0`），列间仅 1px `border-l`，视觉上横向连续贯穿七天。
   - day 模式不传 `showRuler` → 行为完全不变。

2. **列头**：新增 `formatWeekdayHeader(iso, tz): { day: string; weekday: string }`（`format.ts`，用 `toLocaleDateString` 分别取 `day: "numeric"` 与 `weekday: "long"`）。渲染为两行：`text-2xl font-bold` 日期数字 + `text-xs text-muted-foreground` 星期。当天列头加 `bg-primary/10` 背景、日期数字用 `text-primary`。

3. **空提示**：week 模式不传 `emptyHint`（`DayColumn` 中 `emptyHint` 为空时不渲染）。day 模式保留 `timeline.empty`。`timeline.weekEmpty` locale 键保留但不再引用。

4. **i18n**：无新增文案（日期数字由 `toLocaleDateString` 生成）。

## 兼容性

- 仅改 `web/src`，后端接口不变。
- day 模式视觉与功能不变（`showRuler` 默认 true）。
- 无数据流变化，无状态变化。
