# Implement: 轴视图染色卡 + 列表限宽居中

## 执行清单（按序）

1. [ ] `web/src/styles.css` — `.entry-view-card`：圆角改 `--radius-md`，
   删 `border-left: none` 行，底色 8%→10%；`.entry-view-card:hover` 15%→18%
2. [ ] `web/src/styles.css` — 删 `.entry-view-card--running::before` 及其
   `entry-view-breathe` keyframes；新增 `@keyframes entry-view-breathe-bg`
   （background: 10% ↔ 22%），`.entry-view-card--running` 挂动画
3. [ ] `web/src/styles.css` — 新增 `.entry-view-body`：
   `@media (min-width: 768px) { max-width: 520px; margin-inline: auto; }`
4. [ ] `web/src/components/EntryListView.tsx` — `EntryRow.cardStyle` 删
   `borderLeft` 注入与相关注释；外层列表容器（含空态）套 `.entry-view-body`
5. [ ] 验证：`cd web && npx vitest run`
6. [ ] 手动核验（dev server）：宽屏限宽居中 / 窄屏全宽 / 运行中呼吸 /
   hover / 选中 ring / gap 幽灵卡 popover

## 验证命令

```bash
cd web && npx vitest run
cd web && npx tsc --noEmit   # 若项目有此脚本则跑（见 package.json）
```

## 风险文件 / 回滚点

- 仅 `EntryListView.tsx` + `styles.css` 两文件，无数据/接口改动；
  回滚 = revert 这两文件的 diff
- 注意：底色必须留在 CSS（不能内联），否则 hover 18% 覆盖不了内联
  specificity（09-08-axis-view 已踩过的坑，spec 有记录）

## 开始前检查

- [x] design.md 已定稿（方案 H + 520px）
- [x] implement.jsonl / check.jsonl 已策展
