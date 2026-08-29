# PRD: Replace category color palette

## Goal

更换整套分类色板（`--category-1..8` 的 light/dark 两套值），应用于统计页、标签页以及所有复用该色板的界面（时间线色块、分类/标签选择器、计时栏等）。风格方向：**柔和低饱和 + 均衡色轮色相分布**（暖 4 冷 4），区分度优先。

## Confirmed facts（仓库证据）

- 色板数值唯一定义于 `web/src/styles.css:82-120`：
  - `:root`（light）：`oklch(0.72 0.12 H)`，H ∈ {10, 50, 95, 140, 240, 280, 320, 350}
  - `.dark`：`oklch(0.54 0.10 H)`，同色相；另有 `--category-N-foreground` 配对前景色（light 为深色 0.25，dark 为近白 0.97，均带微色相）
- `web/src/format.ts` 的 `CATEGORY_VARS` 仅持有 token 名 `var(--category-N)`，hash 映射不可改动（颜色不落库，改 hash 会改变既有分类映射）
- 使用方：StatsPage、TagsPage、CategoriesPage、Timeline、CategoryPicker、TagPicker、TimerBar
- 约束：185–225 青色区间留给 primary；light 适配冷白底，dark 适配冷深灰底
- 时间线大色块用半透明底色（color-mix），小元素（色点、标签徽章 `styles.css:287-293`）用实色，徽章底色由 `--category-N-foreground` 派生

## 新色板设计（已与用户确认：A 柔和低饱和 + 方案三「均衡色轮」色相分布）

色相分布（OKLCH hue）：15 红 / 50 橙 / 100 黄绿 / 135 绿 / 250 蓝 / 285 紫 / 315 品红 / 345 玫瑰。
暖 4 + 冷 4 均衡绕色环，任何 hash 落点都有明确颜色语义，区分度最稳；避开 185–225 青色区间。

- light：`oklch(0.74 0.09 H)`（降彩度 0.12→0.09，微提亮度）
- dark：`oklch(0.58 0.08 H)`（降彩度 0.10→0.08，微提亮度以保低饱和下的可辨识度）
- foreground 维持现有机制：light 为 `oklch(0.25 0.03 H)` 深色微色相，dark 为 `oklch(0.97 0.01 H)` 近白微色相

| # | H | light `--category-N` | dark `--category-N` |
|---|---|---|---|
| 1 | 15 | oklch(0.74 0.09 15) | oklch(0.58 0.08 15) |
| 2 | 50 | oklch(0.74 0.09 50) | oklch(0.58 0.08 50) |
| 3 | 100 | oklch(0.74 0.09 100) | oklch(0.58 0.08 100) |
| 4 | 135 | oklch(0.74 0.09 135) | oklch(0.58 0.08 135) |
| 5 | 250 | oklch(0.74 0.09 250) | oklch(0.58 0.08 250) |
| 6 | 285 | oklch(0.74 0.09 285) | oklch(0.58 0.08 285) |
| 7 | 315 | oklch(0.74 0.09 315) | oklch(0.58 0.08 315) |
| 8 | 345 | oklch(0.74 0.09 345) | oklch(0.58 0.08 345) |

关键决策记录：用户最初意向为「去黄绿加蓝紫」，在四套候选方案比较后改选方案三（保留黄绿 100，暖 4 冷 4 均衡分布），以区分度和实用性优先。

## Requirements

- R1: 更换 light 与 dark 两套 `--category-1..8` 及对应 `--category-N-foreground` 的具体数值（共 32 个值）
- R2: 不改 `format.ts` 的 hash/索引逻辑与 token 结构；不改 `@theme inline` 映射
- R3: 色相绕色环分布均匀、相邻色可区分，避开 185–225 青色区间
- R4: light 主题适配冷白底、dark 主题适配冷深灰底（低饱和下仍保有区分度）

## Out of scope

- hash 逻辑、色板 token 数量（仍为 8 个）的变更
- 统计/标签页布局与结构改动
- primary/主题色本身的调整

## Acceptance criteria

- A1: `styles.css` 中 16 个 `--category-N` 与 16 个 `--category-N-foreground` 值全部更新为新色板，无遗漏、无残留旧值
- A2: 构建/类型检查通过（`web` 内 lint/build）
- A3: light/dark 两主题下目视检查：统计页、标签页、时间线色块为预期新配色，色相间可区分且不与 primary 混淆

## Open questions

（无阻塞项）
