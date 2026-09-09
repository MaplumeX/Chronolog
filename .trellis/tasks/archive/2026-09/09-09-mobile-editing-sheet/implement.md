# 执行计划：移动端编辑底部弹层范式

## 顺序清单

### Step 1 — `ResponsiveEditPopover` 容器组件
- [ ] 新建 `web/src/components/ResponsiveEditPopover.tsx`（design.md 契约）
- [ ] 桌面分支：`Popover + PopoverAnchor(virtualRef) + PopoverContent`，透传 side/align/sideOffset/width/onFocusOutside
- [ ] 移动分支：`Sheet + SheetContent side="bottom"`，全宽 + `max-h-[85dvh]` 内滚 + `pb-[env(safe-area-inset-bottom)]` + drag handle 视觉条 + sr-only `SheetTitle`
- [ ] 新建 `ResponsiveEditPopover.test.tsx`（双分支渲染 + onOpenChange 回调 + 无 anchor 桌面路径）

### Step 2 — Timeline 接入
- [ ] 替换单一 `Popover` Root（~623）与两处 `PopoverContent`（~834/852）为 `ResponsiveEditPopover`
- [ ] 验证 `EntryListView` 内 `PopoverAnchor` 在移动端无 Root 时的渲染（风险 1）；报错则 Timeline 移动分支补空 Popover Root
- [ ] `Timeline.test.tsx` 新增移动分支用例：块点击 → sheet 打开 → 保存链路

### Step 3 — EntryEditor 窄屏按钮行
- [ ] `EntryEditor.tsx` 加 `useIsMobile` 布局分支（仅按钮区 JSX）：
  - 标题行左侧红色「删除」文字链接（编辑模式）
  - 次操作行：合并上/下 ghost `min-h-12`
  - 主操作行：取消/保存各 `flex-1 h-12`
  - draft 模式仅主操作行
- [ ] 桌面按钮行 JSX 原样保留（条件渲染二选一）
- [ ] 状态/回调/disabled 逻辑零改动
- [ ] 测试：移动端渲染断言（删除链接存在、取消保存 50% 行、draft 无删除合并）

### Step 4 — HierarchicalListCard 接入
- [ ] 两处 `Popover...PopoverContent`（~410-455）替换为 `ResponsiveEditPopover`，传 anchor + onFocusOutside
- [ ] 桌面 focus 守卫（300ms grace）契约不变；移动端 Sheet modal 自管 focus
- [ ] `HierarchicalListCard.test.tsx`：现有桌面用例不动，新增移动分支冒烟（⋯ 菜单 → 编辑 → sheet）

### Step 5 — MergeDialog 窄屏
- [ ] `DialogContent` 加 `max-h-[90dvh] overflow-y-auto`（仅此一处）

### Step 6 — 全量验证
- [ ] `cd web && npx vitest run`（全绿）
- [ ] `npx tsc --noEmit`（或项目 typecheck 命令）
- [ ] `npm run build`（如项目配置）
- [ ] 桌面手测回归点：时间线块编辑 popover、gap 创建、分类/标签 ⋯ 菜单编辑（focus 守卫）
- [ ] 移动模拟器/DevTools 手测点：三个入口 sheet 打开/保存、sheet 内 CategoryPicker 下拉、ConfirmDialog 嵌套、tab bar 遮挡、safe-area

## 验证命令

```bash
cd web && npx vitest run
cd web && npx tsc --noEmit
cd web && npm run build
```

## 回滚点

- 单一 commit 覆盖 Step 1-5；`git revert` 整体回退。无 API/数据/迁移变更。

## Review gates

- Step 2 完成后（风险 1 验证点）自查一次 EntryListView anchor 行为
- Step 6 全绿后 dispatch trellis-check 全量检查
