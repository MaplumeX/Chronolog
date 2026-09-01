# PRD: 将行操作按钮收入下拉菜单

## 背景

分类/标签页面的 `HierarchicalListCard` 组件中，每行操作（添加子项、编辑、归档/取消归档、删除）以平铺按钮形式展示在行尾，hover / focus-within 才显示。按钮较多导致行尾拥挤，视觉噪音大。

## 需求

将每行的操作按钮收进一个 `⋯`（MoreHorizontal 图标）触发的下拉菜单（DropdownMenu）中：

1. 行尾只保留一个菜单触发按钮（ghost icon button，MoreHorizontal 图标），替代现有平铺的多个操作按钮；hover / focus-within 显示行为保持不变。
2. 菜单项按顺序包含：
   - **添加子分类 / 子标签**（仅活动父级行显示；打开现有 `AddChildPopover` 等价的交互）
   - **编辑**（打开现有 `NameColorEditPopover` 等价的交互）
   - **归档 / 取消归档**（仅分类页，沿用现有条件与确认弹窗）
   - **删除**（沿用现有 `ConfirmDialog` 确认弹窗与级联描述）
3. 删除项使用 destructive 样式。
4. 归档区（已归档行）的菜单：沿用现有归档区操作集（编辑 / 取消归档 / 删除，不显示添加子项）。
5. 行为兼容：所有既有功能（级联提示、错误处理、pending 状态、i18n）保持不变。

## 技术要点（实现参考）

- 现有 `AddChildPopover` / `NameColorEditPopover` 是 Popover 组件，不适合直接放进 DropdownMenuItem；实现上可将「添加子项 / 编辑」菜单项点击后弹出现有 Popover（锚定菜单触发按钮），或改为菜单项直接触发的轻量弹窗方案——由实现阶段决定，但交互语义必须保留。
- 使用项目已有的 `web/src/components/ui/dropdown-menu.tsx`（radix-ui 封装）。
- i18n：新增「更多操作」aria-label 等必要文案（categories / tags 两个 namespace 复用现有 key）。

## 验收标准

- [ ] 分类页与标签页每行行尾只有一个 `⋯` 菜单按钮。
- [ ] 菜单内可完成：添加子项（活动父级）、编辑名称/颜色/父级、归档/取消归档（分类）、删除（含确认弹窗）。
- [ ] 已归档行菜单不显示「添加子项」。
- [ ] 删除/归档确认弹窗、级联描述文案、失败可重试语义不变。
- [ ] 现有测试全部通过；为菜单交互补测试（打开菜单、各项可用）。
- [ ] typecheck / web 测试通过（仓库无 lint script，以 typecheck + build + test 为准）。

## 非目标

- 不改变后端接口。
- 不改变树形列表的布局、折叠、归档分区等既有结构。
