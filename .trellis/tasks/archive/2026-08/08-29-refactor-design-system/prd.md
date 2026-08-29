# Refactor web design system

## Goal

重构 web 前端设计系统：将纯灰度 shadcn 中性主题升级为 **teal 冷色系双主题**，治理散落样式收敛到 design token，并沉淀设计规范文档。让产品摆脱"默认 shadcn 感"，建立有辨识度、可维护的视觉体系。

## Background（代码证据）

- 样式入口：`web/src/styles.css`（327 行）
  - Tailwind v4 + `tw-animate-css`，`@custom-variant dark`
  - `:root` light + `.dark` 两套 shadcn CSS 变量，全部为中性灰（oklch chroma=0）
  - `@theme inline` 映射到 `--color-*`；`--radius: 0.625rem`；`--font-sans` 含中文回退栈
  - 约 200 行 Timeline 专用自定义 CSS（timeline-block / ruler / now-line / drag-preview），含硬编码 `rgba(255,255,255,*)`（styles.css:238、260+）
- 主题切换已存在：`ThemeSwitcher.tsx`（light / dark / system 三态，`hooks/use-theme`）
- 分类颜色硬编码 8 色 hex 调色板：`web/src/format.ts:77` `COLORS`（暖橙 `#e07a3d`、黄 `#ffb703` 等与冷色主题气质冲突），按名称 hash 分配（`categoryColor`，format.ts:88），配 WCAG `contrastText`（format.ts:94+）
- Timeline 色块内联 `background: color` + `color: textColor`（Timeline.tsx:212-264）
- 组件：shadcn/ui 14 个基础组件（new-york）+ 6 个业务组件
- spec `frontend/component-guidelines.md` 记载 "Light only: do not add a .dark theme" **已过时**（dark 模式已实现）

## Decisions（用户已确认）

1. **视觉方向 = 冷色系主题**
2. **主题策略 = teal 青主色双主题**：light 冷白底 + teal primary，dark 冷深灰底 + 亮青 primary，两套并重打磨
3. **分类色板纳入本次重构**：8 色统一饱和度/明度步长、与 teal 主题和谐、迁移到 token

## Requirements

### R1 主题 token 翻新（styles.css）

- R1.1 Light 模式：冷白底（微蓝调灰）、teal primary、冷灰 muted/accent/border；全部 oklch 表达
- R1.2 Dark 模式：冷深灰底、亮青 primary、对比度达标的 muted-foreground / border
- R1.3 保留 shadcn 变量命名（`--primary`、`--muted` 等）与 `@theme inline` 映射结构，shadcn/ui 组件零改动即继承新主题
- R1.4 primary 与其上文字（`--primary-foreground`）满足 WCAG AA 对比度（light/dark 各验证）

### R2 分类色板重建

- R2.1 设计新 8 色调色板：统一饱和度/明度步长、色相均匀分布、含 teal 邻近色系但避免与 primary 混淆；每色与 `contrastText` 输出的文字色满足 WCAG AA（4.5:1）
- R2.2 色板迁移为 token（`@theme` 内 `--chart-*` 或自定义 `--category-*` 系列），`format.ts` 引用 token 值而非散落 hex；`categoryColor` hash 分配逻辑与 `contrastText` 机制保留
- R2.3 dark 模式下色块可读（允许通过 CSS 变量在 dark 下微调色板亮度，或在 light/dark 共用一组并验证两模式对比度）

### R3 结构治理

- R3.1 Timeline CSS 中硬编码颜色（`rgba(255,255,255,*)`、`#fff`）改为引用语义 token（如 `--primary-foreground` / `color-mix`），light/dark 下均正确
- R3.2 `now-line` / running 色块轮廓 / drag-preview 在新主题下视觉正确

### R4 体系沉淀（spec 文档）

- R4.1 新建 `.trellis/spec/frontend/design-tokens.md`：色彩体系（语义 token 命名、双主题映射、分类色板）、圆角、排版、间距约定
- R4.2 修正 `component-guidelines.md` 中 "Light only" 过时记载，指向新文档

## Out of Scope

- 不改动任何组件的 DOM 结构 / 交互逻辑 / i18n
- 不引入组件库依赖变化（shadcn/ui 组件除继承主题外零改动）
- 不做 logo / 品牌物料 / 图标更换
- 不重设计 Timeline 布局几何（仅颜色/字体 token 层面）
- 后端零改动

## Acceptance Criteria

- [ ] AC1 `styles.css` 中 light/dark 两套变量均为 teal 冷色系（primary 色相 ≈ teal/cyan 区间），无纯灰度 primary
- [ ] AC2 light 与 dark 下，primary 按钮文字、muted-foreground 正文均达 WCAG AA（4.5:1），用对比度计算验证
- [ ] AC3 新 8 色分类色板：8 色与对应 `contrastText` 文字色对比度均 ≥ 4.5:1，且在 dark 背景上目视可辨
- [ ] AC4 `format.ts` 不再含散落 hex 色板；色板来源可追溯到 token 定义
- [ ] AC5 styles.css Timeline 段无 `rgba(255,255,255,*)` 硬编码白色（改用 token/color-mix），双主题下色块轮廓、now-line、drag-preview 显示正确
- [ ] AC6 `.trellis/spec/frontend/design-tokens.md` 存在且覆盖色彩/圆角/排版约定；`component-guidelines.md` 无 "Light only" 过时内容
- [ ] AC7 `npm run typecheck -w web` 通过；构建成功（`npm run build`）
- [ ] AC8 全部页面（timer/stats/categories/tags/tokens/settings/login）在 light/dark 下人工目检无样式回归

## Open Questions

（无——所有用户决策点已确认）