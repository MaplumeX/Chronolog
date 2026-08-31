# Implement：分类 / 标签页面树形重设计

## 执行清单（按序）

### 1. i18n keys（zh + en 同步）
- [ ] `categories.empty`（空状态引导；`tags.empty` 已有）。
- [ ] `categories.confirmDelete`（两步确认；`tags.confirmDelete` 已有）。
- [ ] 校对两 ns 现有 key 是否全部仍被使用（如 `categories.name` / `tags.name` 表头删除后若仅 popover 使用则保留）。

### 2. 新组件 `web/src/components/HierarchicalListCard.tsx`
- [ ] 按 design.md 契约实现：props 泛型、树形行渲染（父行 chevron + 子行 guide line）、`collapsedIds` 折叠态（默认全展开）、`confirmingId` 两步确认、hover 操作组（`group-hover/row` + `focus-within`，确认态强制可见）、空状态。
- [ ] 复用 `AddChildPopover` / `NameColorEditPopover` / `paletteColor` / `sortHierarchical`。
- [ ] 禁删 title 三态：`deleteBlockedTitle` / `deleteCascadeTitle{count}` / `delete`。

### 3. 页面壳改造
- [ ] `CategoriesPage.tsx`：删表格实现，持 API 逻辑 + `deleteDisabled={(c) => c.entryCount > 0}`，渲染 `HierarchicalListCard`。
- [ ] `TagsPage.tsx`：同上，无 `deleteDisabled`。
- [ ] 创建逻辑（含 `categoryIndex(name)+1` 固定色）保持在页面壳。

### 4. 测试
- [ ] 新增 `web/src/components/HierarchicalListCard.test.tsx`：
  - 树形渲染：父行/子行结构、色点 `paletteColor`、记录数。
  - 折叠/展开：默认展开、点击 chevron 收起子行、再点展开。
  - 两步确认：点删除 → 「确认删除？」→ 回调触发；未确认不触发。
  - 禁删：`deleteDisabled` 为 true 时按钮 disabled + title。
  - 空状态文案。
- [ ] 全量回归：`npm run test`。

### 5. 验证命令（web/）
```bash
npm run test          # vitest 全量
npm run build         # tsc --noEmit + vite build
```

## 风险与回滚点

- 风险文件：`web/src/pages/CategoriesPage.tsx`、`web/src/pages/TagsPage.tsx`（大改）、新增 `HierarchicalListCard.tsx`。
- radix popover 在 jsdom 下的 pointer-events / portal 泄漏：沿用 `CategoryPicker.test.tsx` 的 setup 惯例。
- 回滚：纯前端单 PR，revert 即可；无数据/API 变更。

## start 前检查
- [x] prd.md 收敛（决策 D1/D2 已写入）
- [x] design.md / implement.md 就绪
- [ ] implement.jsonl / check.jsonl 已填真实条目
