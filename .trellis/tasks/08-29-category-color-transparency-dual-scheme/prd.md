# PRD：分类颜色透明度 + light/dark 双套色板

## 背景

当前分类色板（`--category-1..8`）light/dark 共用同一组 oklch 值（统一 L=0.63 C=0.11），声明在 `web/src/styles.css` 的 `:root, .dark` 中，`web/src/format.ts` 的 `COLORS` 数组硬编码同值。`categoryColor(name)` 按名称 hash 返回固定 oklch 字符串，组件以内联 style 使用；Timeline 色块文字颜色由 `contrastText()`（JS 内 WCAG 计算）决定。

## 需求

### R1 分类色块加透明度（Timeline 时间块）

- Timeline 时间块（drag-create 预览块同理）的底色改为**带 alpha 的半透明色**，能透出轨道背景。
- 小元素保持实色不变：分类/标签选择器小圆点、CategoriesPage / TagsPage 列表色点、StatsPage 的条形与标签点等。
- 透明度实现方式（token 内带 alpha vs 使用处 color-mix）在 design 阶段决定。

### R2 light / dark 各一套分类色板

- **light 模式**：使用 L 更高的亮版（如 L≈0.70+），适配冷白底。
- **dark 模式**：使用 L 更低的暗版（如 L≈0.55 以下），适配冷深灰底。
- 色相环分布、C 值、青色 185–225 区间留给 primary 的约束维持现状。
- `format.ts` 的 `COLORS` 数组与 CSS token 同步策略改变（返回 `var(--category-N)` 交给 CSS 明暗切换，还是其他方式）在 design 阶段决定。
- Timeline 色块文字颜色策略（保留 `contrastText` JS 计算还是配套 `--category-N-foreground` token）在 design 阶段决定；无论哪种，明暗两态下文字与色块对比度需保持可读（目标 WCAG AA 大号文本 ≥3:1）。

## 约束

- 分类颜色不落库，始终由名称 hash 分配（现状不变）。
- 不改后端。
- 不改 hash 分配逻辑（`categoryColor` 的 hash 部分不动）。

## 验收标准

- AC1：Timeline 时间块底色为半透明，能透出轨道背景；dark 模式下同样生效。
- AC2：light 模式分类色整体偏亮、dark 模式整体偏暗，两个模式下色块/圆点视觉舒适、可区分。
- AC3：Timeline 色块文字在 light/dark 两套色板下均清晰可读（对比度达标）。
- AC4：小元素（选择器圆点、列表色点、Stats 条形）颜色与 Timeline 块同色相，视觉一致。
- AC5：`pnpm build`（web）通过，现有测试通过。