# Design：分类颜色透明度 + light/dark 双套色板

## 目标文件

| 文件 | 改动 |
|---|---|
| `web/src/styles.css` | 拆分 `:root, .dark` 为两套 `--category-1..8`；新增 `--category-N-foreground` |
| `web/src/format.ts` | `COLORS` → `CATEGORY_VARS`；`categoryColor` 返回 `var(--category-N)`；删除 `contrastText` 及亮度计算代码 |
| `web/src/components/Timeline.tsx` | `blockStyle` 用 `color-mix` 半透明底色；文字色改用配套 token |

小圆点/条形等使用处（CategoryPicker、TagPicker、CategoriesPage、TagsPage、StatsPage、TimerBar）**零改动**——`categoryColor()` 返回值从 oklch 字符串变成 `var(--category-N)` 对内联 style 完全兼容，且随主题自动切换。

## 决策

### D1 token 策略：CSS 变量 + 双套值

现状问题是 `format.ts` 硬编码 oklch 值与 CSS 同源同步（两处维护、无法随主题变）。改为：

- `categoryColor(name)` hash 后返回 `"var(--category-N)"`（N 为 1–8）
- `styles.css` 中 `:root` 定义 light 亮版、`.dark` 定义 dark 暗版
- **不再需要两边同步**：TS 侧只持有 token 名，具体数值只在 CSS 一处

明暗两套数值起点（保持现有色相分布与青色区间预留）：

```css
:root {
  --category-1: oklch(0.72 0.12 10);
  /* ...light：L 0.70–0.74, C 0.11–0.13 */
  --category-1-foreground: oklch(0.22 0.03 var(--category-h-1));
}
.dark {
  --category-1: oklch(0.55 0.10 10);
  /* ...dark：L 0.52–0.56, C 0.09–0.11 */
  --category-1-foreground: oklch(0.97 0.01 var(--category-h-1));
}
```

> L / C 具体数值为起点，实现时结合视觉效果微调，无需回批设计。

### D2 透明度：Timeline 色块 color-mix，不做 alpha token

需求确认是色块整体半透明（1a）。实现：

```tsx
// Timeline.tsx blockStyle
background: `color-mix(in srgb, ${color} 80%, transparent)`,
color: `var(--category-${n}-foreground)`,
```

不做成 `--category-N-alpha` token，理由：唯一大色块消费场景是 Timeline，`color-mix` 一行即可；等出现第二个半透明消费场景再抽 token（YAGNI）。

小圆点等场景继续用 `categoryColor()` 返回值原样（实色）。

### D3 文字色：配套 `--category-N-foreground` token 替代 `contrastText` JS 计算

现状 `contrastText()` 在 JS 里算 WCAG 亮度返回 `#fff`/`#111`，问题：

1. 明暗两套色板后，同一分类在两模式下的最优文字色可能不同，JS 静态值无法响应主题切换（除非监听主题重算）
2. 每个色相配一个精心设计的前景 token（如 dark 下暖红配近白略带色相）视觉上优于纯白

改为每个 `--category-N` 配套 `--category-N-foreground`，颜色由 CSS 声明。`contrastText`、`relativeLuminance` 及 oklch→sRGB 变换代码全部删除（唯一调用方是 Timeline）。

### D4 hash → N 的映射与 categoryColor 返回值

`categoryColor` 保持 hash 逻辑不变，返回 `var(--category-N)`。同时新增内部导出（或直接在 Timeline 用模板字符串拼接）：Timeline 需要 `var(--category-N-foreground)`，由 `categoryColor` 同步返回索引最简单——新增 `categoryColorVar(name): { bg: string; fg: string }` 或让 `categoryColor` 返回索引由调用方拼。**采用**：`format.ts` 新增 `categoryIndex(name): number`（导出），`categoryColor` = `var(--category-${categoryIndex(name) + 1})` 保持向后兼容，Timeline 用索引拼 foreground。

## 兼容性

- `categoryColor` 返回类型 string 不变，所有内联 style 消费处无需改动
- 删除 `contrastText` 是 breaking（仅 Timeline 使用，同任务内一并改掉）
- 分类颜色不落库、hash 不变 → 用户看到的分类→颜色映射不变，只是颜色的明暗值变了

## 回滚

单 commit，revert 即可整体回滚。