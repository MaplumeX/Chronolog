# Design — Refactor web design system

## 架构与边界

改动收敛在 web 前端的样式层与常量层，组件 DOM/逻辑零改动：

```
web/src/styles.css          ← 主题 token 翻新 + 分类色板 token + Timeline CSS 治理（核心）
web/src/format.ts           ← COLORS 色板改为引用 token（categoryColor/contrastText 逻辑不动）
web/src/components/*.tsx    ← 仅 Timeline.tsx 内联 style 若需变量化才动（预计不动）
.trellis/spec/frontend/     ← design-tokens.md 新建 + component-guidelines.md 修正
```

## 色彩设计（核心契约）

### 语义 token（保留 shadcn 命名，全部 oklch）

Light（`:root`）：

- `--background: oklch(0.985 0.005 220)` 级冷白；`--foreground: oklch(0.22 0.02 230)`
- `--primary: oklch(0.55 0.11 200)` teal；`--primary-foreground: oklch(0.985 0.005 220)`
- muted/accent/secondary 用低蓝调灰（chroma 0.01–0.02，hue 220–230）
- `--destructive` 保持红（oklch hue 25–27）
- `--ring` 跟随 primary；sidebar 系列与 background 同族

Dark（`.dark`）：

- `--background: oklch(0.16 0.015 230)` 冷深灰；`--foreground: oklch(0.93 0.01 220)`
- `--primary: oklch(0.75 0.10 195)` 亮青；`--primary-foreground: oklch(0.18 0.03 220)`
- border/input 用半透明白（现有模式保留）

以上数值为设计起点，实现时按 WCAG 对比度逐对校准（见验证节）。

### 分类色板 token

在 `@theme inline` 中新增 `--category-1..8`（oklch，色相绕色环均匀分布、统一 C≈0.10–0.13 与 L≈0.62–0.68），`format.ts` 的 `COLORS` 数组读取这些 token。由于 `categoryColor` 返回值需要用于内联 style，且 `contrastText` 需 hex/可计算值，方案：

- **采用方案 A**：`format.ts` 保留一份与 token 同源的 oklch 字符串数组（注释锚定 styles.css token 名），`contrastText` 改为解析 oklch 计算亮度。CSS token 用于 dark 模式微调时通过 CSS 变量覆盖色块 `filter: brightness()` 或 color-mix —— 实现时验证，若 dark 下共用色板对比度足够则不做 per-theme 覆盖（简化）。
- 备选方案 B（若 A 的 oklch 亮度换算复杂）：保留 hex 色板但集中定义并注释映射。**决策留到实现首个检查点，不影响 PRD 验收（AC4 要求"可追溯"即可）。**

## 数据流

- 色块渲染路径不变：`categoryColor(name)` → hex/oklch → 内联 style + `contrastText`
- 主题切换路径不变：`use-theme` hook → `.dark` class → CSS 变量整体翻转

## 兼容性

- shadcn/ui 14 组件只消费语义 class（`bg-primary` 等），token 换值零代码改动
- `--chart-1..5` 现无消费者（StatsPage 未使用），可复用作 `--category-*` 或保留
- 风险点：`ui/sidebar.tsx` 大量使用 sidebar-* token，需逐个目检 dark 效果

## 取舍记录

- **单任务不拆 parent/child**：色板依赖 token，spec 文档依赖前两者落地，交付物强耦合；规模约 1–2 天，用 implement.md 的有序清单控制节奏即可
- **不引入运行时 CSS-in-JS 或主题切换库**：现有 CSS 变量方案已够用
- **Timeline 几何不动**：本次只治理颜色层，降低回归面

## 验证与回滚

- 对比度验证：脚本化计算（oklch→sRGB→相对亮度→对比度比），对 primary/foreground、muted-foreground、8 分类色各出数值，写入任务 research
- 视觉目检：dev server 起后 light/dark 双模式过一遍 8 个页面 + Timeline 色块三形态（block/compact/mini + running/drag-preview）
- 回滚点：commit 按阶段划分（token 翻新 / 色板 / CSS 治理 / spec 文档），任一阶段可独立 revert