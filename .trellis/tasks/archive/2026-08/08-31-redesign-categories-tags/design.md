# Design：分类 / 标签页面树形重设计

## 架构与边界

新增一个共享组件 `web/src/components/HierarchicalListCard.tsx`，两页改为薄配置壳：

```
CategoriesPage.tsx  ─┐
                     ├─→ HierarchicalListCard<T extends Category | Tag>（props 驱动）
TagsPage.tsx        ─┘
```

- `HierarchicalListCard` 是纯 UI + 状态组件，**不直接 import `api`**；所有数据操作经 props 注入。
- 复用不动：`AddChildPopover`、`NameColorEditPopover`、`ColorPalettePicker`、`hierarchy.ts`（`sortHierarchical` / `topLevel`）。
- 页面壳（`CategoriesPage` / `TagsPage`）保留：加载/`reload`、创建/删除/编辑的 API 调用与错误兜底（`ApiError.message` + i18n fallback）、`PageContainer wide`。

## 组件契约

```ts
type HierarchyItem = { id: string; name: string; color: number | null; entryCount: number; parentId: string | null };

interface HierarchicalListCardProps<T extends HierarchyItem> {
  namespace: "categories" | "tags";                    // i18n ns + popover namespace
  items: T[];
  topOptions: T[];                                    // 父级可选项（topLevel 结果，页面计算）
  onCreateChild: (parent: T, name: string) => Promise<void>;
  onUpdate: (item: T, next: { name: string; color: number; parentId: string | null }) => Promise<void>;
  onDelete: (item: T) => Promise<void>;
  deleteDisabled?: (item: T) => boolean;              // 分类页传 entryCount > 0；标签页不传
}
// 注：顶层创建（onCreate）不在契约内——工具行由页面壳持有（见「树形 UI 结构」）。
```

- 两步确认状态（`confirmingId`）与折叠状态（`collapsedIds: Set<string>`）是组件内部状态。
- 删除 `title` 逻辑：`deleteDisabled(item)` → `deleteBlockedTitle`；有子级 → `deleteCascadeTitle{count}`；否则 `delete`。

## 树形 UI 结构（D1 方案 A）

单张轻卡片（`Card` + `CardContent p-0`，延续 table-in-card 的卡片骨架但内部不再是 Table）：

```
Card (rounded-lg border shadow-xs overflow-hidden)
├─ 工具行（卡片外顶部，页面壳持有）：Input + 添加按钮（现状保留）+ 错误文案
└─ 行列表（divide-y 或每行 border-b hairline）
   ├─ 父行: [chevron 按钮(有子级时)] [色点] [名称 font-medium] [记录数 text-xs muted ml-auto] [操作组(hover 显示)]
   └─ 子行(未折叠时): [pl-6 guide line + 色点 + 名称] [记录数] [操作组]
```

- chevron：lucide `ChevronDown` / `ChevronRight`，`aria-expanded`，无子级的父行不渲染 chevron（占位对齐用透明 spacer）。
- 操作组 hover 显示：`opacity-0 group-hover/row:opacity-100` + `focus-within:opacity-100`（键盘可达），两步确认激活时强制可见（`data-confirming` 态或条件类）。
- 折叠状态 `collapsedIds` 为 `Set<string>`，切换只影响该父行的子级渲染；默认（空 set）= 全展开。
- 空状态：卡片内居中引导文案（`{ns}.empty`，标签已有该 key，分类补一个）。

## 数据流

页面壳加载（`useEffect` → `api.categories()/tags()`）→ `items` + `topOptions` 传入组件 → 用户操作回调 → 页面壳调 API → `reload()` → 新 `items` 重渲染。创建顶层/子级的 `categoryIndex(name)+1` 固定色逻辑留在页面壳（与现状一致）。

## 兼容性

- 后端 API、popover 组件 props、`hierarchy.ts`、颜色 hash 契约均不变。
- `CategoryPicker` / `TagPicker` / `StatsPage` 不受影响（它们只消费 API 数据）。
- i18n：新增 key 仅 `{ns}.empty`（分类）；`confirmDelete` 分类侧补齐；删除/折叠相关沿用现有 key，无破坏性改动。
- Goals / Tokens 页保持 table-in-card，不动。

## 权衡

- **组件泛型 vs 双份数据适配**：选泛型（两数据形状本就同构：`id/name/color/entryCount/parentId`），差异仅 API 调用与禁删规则，props 注入即可。
- **折叠状态放组件内 vs 页面**：组件内（非持久化）。当前无跨会话记忆需求，避免过早引入 localStorage 契约。
- **hover 显示操作 vs 常驻**：hover + focus-within 可达性平衡；触屏设备点击行也会触发 hover 态（移动端可用性可接受，操作按钮仍是 DOM 内可聚焦元素）。

## 测试策略

- 新增 `HierarchicalListCard.test.tsx`：树形渲染（父子缩进/色点）、折叠展开、两步确认删除、禁删 title、空状态；props 回调用 vi.fn() mock。
- 页面壳逻辑薄，现有测试体系（vitest + RTL，i18n pin en）沿用；radix portal 泄漏按 `CategoryPicker.test.tsx` 惯例清理。
- 回归：`npm run test`、`npm run build`（含 tsc --noEmit）。

## 回滚

纯前端 UI 层改动，单 commit 可整体 revert；无数据迁移、无 API 变更。
