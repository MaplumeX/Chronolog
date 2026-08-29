# Implement — Refactor web design system

## 执行清单（有序）

### 阶段 1：主题 token 翻新
- [ ] 1.1 设计并写入 light 变量：冷白底 + teal primary（`styles.css` `:root`），按 design.md 数值起点逐对校准 WCAG AA
- [ ] 1.2 写入 dark 变量：冷深灰底 + 亮青 primary（`.dark`）
- [ ] 1.3 对比度脚本验证：primary/foreground、muted-foreground、background 组合，light/dark 各跑一遍，结果记入 research
- [ ] 1.4 dev server 目检 shadcn 组件（button/dialog/input/tabs/sidebar）双主题效果，微调 token

### 阶段 2：分类色板重建
- [ ] 2.1 设计 8 色板（oklch，统一饱和度/明度、色相均匀、避开 primary 混淆），写入 `@theme` token
- [ ] 2.2 迁移 `format.ts` COLORS 引用 token（方案 A/B 按设计文档检查点决策），`categoryColor`/`contrastText` 逻辑保留
- [ ] 2.3 对比度验证 8 色 × contrastText ≥ 4.5:1；dark 背景上目检色块可读，必要时加 dark 覆盖
- [ ] 2.4 Timeline 色块三形态（block/compact/mini）+ running 轮廓 + drag-preview + now-line 双主题目检

### 阶段 3：结构治理
- [ ] 3.1 替换 styles.css Timeline 段硬编码白色（`rgba(255,255,255,*)`、`#fff`）为 token / color-mix，双主题验证
- [ ] 3.2 全局 grep 复查：tsx 与 css 中不应再残留与主题无关的散落颜色字面量

### 阶段 4：spec 沉淀
- [ ] 4.1 新建 `.trellis/spec/frontend/design-tokens.md`（色彩体系、双主题映射、分类色板、圆角、排版、间距约定）
- [ ] 4.2 修正 `component-guidelines.md` "Light only" 过时记载，链接新文档

### 阶段 5：收尾验证
- [ ] 5.1 `npm run typecheck -w web` 通过
- [ ] 5.2 `npm run build` 通过
- [ ] 5.3 8 页面（timer/stats/categories/tags/tokens/settings/login）light/dark 人工目检
- [ ] 5.4 更新 check.jsonl 对应 manifest 后派发 check sub-agent

## 验证命令

```bash
npm run typecheck -w web
npm run build
# 对比度：实现时写一次性 node 脚本（oklch→sRGB），输出各 token 对比度表
# 目检：npm run dev → http://localhost:5173 切换 ThemeSwitcher 双模式
```

## 风险文件与回滚点

- `web/src/styles.css`（核心，token + Timeline CSS 都在此）
- `web/src/format.ts`（色板迁移；hash 与对比度逻辑勿动）
- 回滚：阶段间分别 commit（token / 色板 / CSS 治理 / spec），可按阶段 revert

## start 前检查

- [ ] implement.jsonl / check.jsonl 各含至少一条真实条目（非 _example）
- [ ] 用户批准最终规划摘要