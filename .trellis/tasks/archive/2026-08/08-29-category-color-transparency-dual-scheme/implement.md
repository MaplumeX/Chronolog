# Implement：分类颜色透明度 + light/dark 双套色板

## 执行清单

1. [x] `web/src/styles.css`
   - 把现有 `:root, .dark { --category-1..8 }` 拆为 `:root`（light 亮版 L≈0.72）与 `.dark`（暗版 L≈0.55）两块
   - 每套内新增 `--category-N-foreground`（light 下深色文字、dark 下近白文字，可微带对应色相）
   - `@theme inline` 无需改（`--color-category-*` 引用关系不变）
2. [x] `web/src/format.ts`
   - `COLORS` 常量改为 `CATEGORY_VARS = ["var(--category-1)", ..., "var(--category-8)"]`（或新增 `categoryIndex`）
   - `categoryColor(name)` 返回 token 引用
   - 删除 `contrastText` / `relativeLuminance` / `DARK_TEXT_LUMINANCE` 及 oklch→sRGB 变换代码
3. [x] `web/src/components/Timeline.tsx`
   - `blockStyle.background` 改为 `color-mix(in srgb, <categoryColor> 80%, transparent)`
   - `blockStyle.color` 改用配套 `var(--category-N-foreground)`
4. [x]（对比度已由脚本验证 light 7.5-8.0:1、dark 6.0-6.5:1；视觉目检留待用户验收） 视觉验证：light / dark 两个模式检查 Timeline 块（full/compact/mini 档）、running 脉冲、drag-preview、小圆点、Stats 条形
5. [x] 更新 spec：`.trellis/spec/frontend/design-tokens.md`（双套色板、`--category-N-foreground`、`contrastText` 已删除）；检查 `component-guidelines.md` / `quality-guidelines.md` 中对 `contrastText` 的引用并修正

## 验证命令

```bash
cd web && pnpm build
```

（若存在 web 侧测试/lint 也一并跑）

## 审查点

- Timeline 半透明效果在两个主题下是否"透出轨道背景但不影响文字可读"
- 8 色 × 2 模式下 `--category-N-foreground` 与块底色的对比度（目标 ≥3:1，大号/粗体文本）
- drag-preview 块文字在半透明下仍可读（其底色是 primary，非分类色，应不受影响——确认）

## 回滚点

单 commit，`git revert` 即可。