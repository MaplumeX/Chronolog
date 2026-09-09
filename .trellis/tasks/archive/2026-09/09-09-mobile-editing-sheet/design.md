# 技术设计：移动端编辑底部弹层范式

## 决策摘要（用户已拍板）

- D1 移动端编辑容器 = 底部 Sheet（`ui/sheet` `side="bottom"`）。
- D2 EntryEditor 窄屏按钮 = 分层式：次操作行（合并上/下，ghost，48px）在上，主操作行（取消/保存各 50%，48px）在下；删除移到标题行左侧红色文字链接。

## 架构：容器层分支，表单组件不动

核心原则（R6）：`EntryEditor` / `AddChildPopoverForm` / `NameColorEditPopoverForm` 的 props 契约与业务逻辑零改动，只做**容器层**分支。新增一个纯容器组件统一承担「移动端 Sheet / 桌面 Popover」的分叉：

```
web/src/components/ResponsiveEditPopover.tsx   （新）
```

```tsx
// 契约草案
export function ResponsiveEditPopover(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 桌面端锚定（virtualRef 或节点）— 移动端忽略 */
  anchor?: React.RefObject<HTMLElement | null>;
  /** 桌面端 popover 定位参数，移动端忽略 */
  side?: "right"; align?: "center"; sideOffset?: number; width?: string;
  /** 桌面端 focus 守卫（HierarchicalListCard 的 300ms grace）— 移动端忽略 */
  onFocusOutside?: (e: FocusEvent) => void;
  /** Sheet 语义标题（sr-only 或 handle 行） */
  srTitle: string;
  children: ReactNode;
})
```

- 桌面（`!isMobile`）：渲染现有 `Popover + PopoverAnchor + PopoverContent`，透传所有锚定/守卫 props —— **行为与 DOM 与现状等价**。
- 移动（`isMobile`）：渲染 `Sheet + SheetContent side="bottom"`，全宽、内部 `max-h-[85dvh] overflow-y-auto`、`pb-[env(safe-area-inset-bottom)]`、顶部 drag handle（视觉条，非交互拖拽）+ `SheetTitle`（sr-only，满足 Radix a11y 要求）。

## 各接入点改动

### 1. Timeline（EntryEditor 三个入口）

`Timeline.tsx` 中单一 `Popover`（~623）+ 两处 `PopoverContent side="right" w-80`（~834/852）替换为 `ResponsiveEditPopover`。选中卡/幽灵卡的 `PopoverAnchor` 零尺寸锚点仅在桌面分支渲染（组件内部处理，锚点 props 移动端不消费）。`open`/`onOpenChange` 逻辑（`selectedEntry != null || draft != null || gapDraft != null`、关闭时 `setSelectedId(null); clearDraft()`）原样透传。

**注意**：`EntryListView` 必须渲染在 Timeline 的 Popover Root 内（spec 约定，其内部含 `PopoverAnchor`）。设计改为：`ResponsiveEditPopover` 在桌面分支渲染 Popover Root，`EntryListView` 的渲染位置保持在其内；移动分支 Sheet 自身是独立 Portal，EntryListView 中的 PopoverAnchor 移动端无 Root 也可安全渲染（Radix Anchor 无 Root 时退化为普通元素）——需在实现中验证，若报错则移动端在 Timeline 层补一个不打开的空 Popover Root 包裹。

### 2. HierarchicalListCard（编辑/添加子项）

两处 `Popover + PopoverAnchor virtualRef + PopoverContent w-72 + onFocusOutside 守卫`（~410-455）替换为 `ResponsiveEditPopover`，传 `anchor` + `onFocusOutside`。桌面路径的 `popoverOpenedAtRef` 300ms focus 守卫契约不变（组件透传）。移动端 ⋯ 菜单 `onSelect` 里 `setPopoverTarget` 后无需 focus 守卫（Sheet 是 modal，Radix Dialog 自己管 focus）。

### 3. EntryEditor 窄屏按钮行（D2）

`EntryEditor.tsx` 内部加 `isMobile`（`useIsMobile()`）布局分支，**仅按钮区 JSX 变化，状态与回调不变**：

- 移动端：
  - 标题行：`[删除(红色文字链接, ghost, min-h-12)]  ...  [编辑/新建标题]`（删除左对齐）
  - 次操作行：`[合并上一条] [合并下一条]`（ghost + 图标，`min-h-12`，均分或 wrap）
  - 主操作行：`[取消 50%] [保存 50%]`（`h-12`，保存 `flex-1`）
  - 新建模式（draft）：无删除/合并，仅主操作行
- 桌面端：现有单行 `flex-wrap justify-end` 结构原样保留。
- 删除仍走 `ConfirmDialog`（不变）；`disabled` 条件不变。

### 4. MergeDialog 窄屏

轻改：`DialogContent` 加 `max-h-[90dvh] overflow-y-auto`；双卡预览容器 `space-y-2` 已是堆叠，无需改结构。卡内 `truncate` 已有。无需新分支。

## 层叠与 safe-area

- `ui/sheet` overlay/content 均 `z-50` > `MobileTabBar` 的 `z-40` → 覆盖关系天然成立（AC7），无需改 z。
- `SheetContent side="bottom"` 追加 `pb-[env(safe-area-inset-bottom)]`；内容区 `max-h-[85dvh] overflow-y-auto`（避免覆盖顶部状态栏）。
- 关闭动画期间 sheet 仍在 z-50，无 tab bar 闪现问题。

## 测试策略

- 现有 `Timeline.test.tsx` / `HierarchicalListCard.test.tsx` 已 mock `useIsMobile`（`vi.mock`），桌面断言不动。
- 新增：
  - `ResponsiveEditPopover.test.tsx`：桌面渲染 PopoverContent / 移动渲染 SheetContent；`onOpenChange(false)`（sheet 关闭、Escape）回调链路；不传 anchor 时桌面分支正常。
  - `Timeline.test.tsx` 移动分支：点击块 → sheet 出现 → 保存调用 `api.updateEntry` mock → `onSaved` 关闭。
  - `EntryEditor` 按钮：移动端渲染「删除文字链接 + 取消/保存 50% 行」、draft 模式无删除/合并。
  - `MergeDialog`：窄屏无专门断言（结构未变），维持现有用例。
- `matchMedia` stub 已存在于 Timeline.test（Sheet/Popover 均需要）。

## 风险与回滚

- 风险 1：Radix `PopoverAnchor` 无 Root 时的行为（见上文验证点）。回滚方案：Timeline 移动分支补空 Popover Root。
- 风险 2：Sheet 内 `CategoryPicker`/`TagPicker`（DropdownMenu modal）嵌套 modal —— Radix 支持（ConfirmDialog 已在 Popover 内工作，同机制）；实现后需手测一次。
- 风险 3：桌面回归 —— 所有桌面路径通过 `ResponsiveEditPopover` 透传保证等价；靠现有测试守护。
- 回滚点：单 commit，`git revert` 即可整体回退（无 API/数据变更）。

## 兼容性

- 无 API、无 localStorage 键、无 i18n 新键以外的变更（新增 `srTitle` 复用现有 `entry.edit` / `entry.create` / `categories.name` 等现有键，预计零新键）。
- 桌面端 DOM：Popover 层级多包一层 `ResponsiveEditPopover` 函数组件（不产生额外 DOM 节点）。
