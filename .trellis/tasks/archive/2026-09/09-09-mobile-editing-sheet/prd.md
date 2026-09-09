# 移动端编辑体验适配：底部弹层范式

## Goal

移动端（<768px，`useIsMobile()`）的编辑类交互从「锚定 popover」范式迁移到底部弹层（Sheet）范式，解决窄屏 popover 被 clamp/翻转、表单挤压、按钮行拥挤的问题。桌面端行为完全不变。

## Background / 现状（代码勘察结论）

- Session 47（09-08-mobile-responsive）完成了导航/时间线/触屏命中区适配，但编辑交互仍是桌面 popover 范式：
  - `Timeline.tsx`（~834/852）：选中条目 / draft / gapDraft 的 `EntryEditor` 用 `PopoverContent side="right" w-80`，移动端 320px 宽 popover 频繁 clamp/翻转。
  - `HierarchicalListCard.tsx`（~417/440）：`AddChildPopoverForm` / `NameColorEditPopoverForm` 用 `PopoverAnchor virtualRef` 锚定 ⋯ 按钮，`w-72`，同样问题。
  - `EntryEditor` 底部按钮行：删除(mr-auto) + 合并上 + 合并下 + 取消 + 保存，`flex-wrap justify-end`，窄屏挤压、命中区不足。
- `ui/sheet.tsx` 已存在（sidebar 使用），支持 `side="bottom"`，含 overlay / 滑入滑出动画 / safe-area 需自行补。
- `MergeDialog` / `GoalEditorDialog` 走 `ui/dialog`（全局 `max-w-[calc(100%-2rem)]` clamp，GoalEditorDialog 已做窄屏堆叠 + `max-h-[90dvh]`），问题相对较小。
- `CategoryPicker` / `TagPicker` 是 `DropdownMenu`（modal），嵌在编辑容器内。

## Requirements

- R1 移动端编辑容器范式：`EntryEditor`（编辑既有条目 / draft 新建 / gap 回填三种入口）在移动端以底部弹层（`ui/sheet` side="bottom"）呈现；桌面端保持现有 popover 行为与 DOM 结构不变。
- R2 `EntryEditor` 内部表单与按钮组在窄屏可用：按钮行重排（具体形态待定），全部命中区 ≥40px。
- R3 分类/标签页的编辑/添加子项（`HierarchicalListCard` 的 `NameColorEditPopoverForm` / `AddChildPopoverForm`）移动端同样走底部弹层范式；桌面 popover + virtualRef 锚定 + focus 守卫契约不变。
- R4 底部弹层与 `MobileTabBar`（fixed bottom, z-40）层叠关系正确：sheet 覆盖 tab bar，关闭后不遮挡；处理 `env(safe-area-inset-bottom)`。
- R5 `MergeDialog` 双卡预览在窄屏可用（必要时堆叠/宽度适配）。
- R6 无 API / 业务逻辑变更；`EntryEditor`、表单组件的 props 契约保持不变（仅容器层变化）。

## Out of Scope

- 桌面端编辑交互任何变更。
- `CategoryPicker`/`TagPicker` 的 DropdownMenu 形态重做（sheet 内继续用现有下拉，除非检查发现不可用）。
- 新增 i18n 语言；`touch-hit`/`touch-always-visible` 能力断点体系调整。

## Acceptance Criteria

- [ ] AC1 移动端（<768px）点击时间线块 / gap 幽灵卡 / 条目轴卡片，编辑器以底部弹层打开，全宽、内容可滚动、不被 tab bar 遮挡；保存/取消/删除/合并全部功能可用（端到端）。
- [ ] AC2 桌面端（≥768px）行为与现在完全一致（popover 右侧锚定、DOM、测试不需改桌面断言）。
- [ ] AC3 分类/标签页 ⋯ 菜单 → 编辑/添加子项在移动端以底部弹层打开，保存/取消可用；桌面 popover 路径不变。
- [ ] AC4 EntryEditor 按钮行在 ~375px 宽下可读、不溢出、命中区 ≥40px。
- [ ] AC5 MergeDialog 在 ~375px 宽下双卡预览可读、按钮可用。
- [ ] AC6 现有测试全绿 + 新增移动端渲染分支测试（useIsMobile mock）覆盖 sheet 打开/关闭/保存回调链路。
- [ ] AC7 sheet 层级覆盖 MobileTabBar(z-40)，safe-area 处理正确。

## Resolved Decisions

- Q1 ✅ 底部 Sheet（`ui/sheet` side="bottom"）：移动端编辑容器统一为底部弹层。

## Open Questions

- Q2（用户决策）：EntryEditor 按钮行窄屏形态 —— 具体重排方案。
