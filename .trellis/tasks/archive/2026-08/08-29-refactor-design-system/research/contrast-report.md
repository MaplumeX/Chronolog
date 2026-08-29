# Contrast Report — teal 双主题

脚本：`research/contrast-check.mjs`（一次性，oklch → 线性 sRGB → WCAG 相对亮度 → 对比度比）。
运行：`node .trellis/tasks/08-29-refactor-design-system/research/contrast-check.mjs`

脚本中的候选数值与 `web/src/styles.css` 最终 token 保持同步。

## 语义 token（阈值 4.5:1，全部 PASS）

| 组合 | Light | Dark |
|------|-------|------|
| foreground × background | 16.55:1 | 15.70:1 |
| primary × primary-foreground | 5.26:1 | 9.37:1 |
| muted-foreground × background | 6.79:1 | 7.78:1 |
| secondary-foreground × secondary | 12.41:1 | 12.64:1 |
| accent-foreground × accent | 12.41:1 | 11.86:1 |

Light primary `oklch(0.5 0.11 200)` × 白字 5.26:1 达标（design.md 起点 `0.55` 只有 ≈4.4:1，故压暗到 `0.5`）。

## 分类色板（`--category-1..8`，统一 L=0.63 C=0.11，light/dark 共用）

`contrastText` 对 8 色均输出 `#111` 深色文字，全部 ≥ 4.5:1：

| Token | hue | 对比度（× #111） | 白字对比度（未选用） |
|-------|-----|-----------------|---------------------|
| --category-1 | 10 | 5.10:1 | 3.70 |
| --category-2 | 50 | 5.20:1 | 3.63 |
| --category-3 | 95 | 5.41:1 | 3.49 |
| --category-4 | 140 | 5.63:1 | 3.35 |
| --category-5 | 240 | 5.48:1 | 3.45 |
| --category-6 | 280 | 5.26:1 | 3.59 |
| --category-7 | 320 | 5.13:1 | 3.68 |
| --category-8 | 350 | 5.10:1 | 3.70 |

Dark 可读性：色块 L=0.63 远高于 dark 背景 L=0.165，共用一组色板即可，无需 per-theme 覆盖（design.md 预留的简化分支成立）。色相分布避开 185–225（primary teal 区间），8 hue：10/50/95/140/240/280/320/350。

## 方案决策

采用 **方案 A**：`format.ts` 保留与 `@theme` token 同源的 oklch 字符串数组（注释锚定 `--category-1..8`），`relativeLuminance` 扩展为同时解析 hex 与 `oklch(L C H)`。oklch→sRGB 换算即标准 Oklab 变换，复杂度可控，故不需要方案 B 的 hex 双份维护。