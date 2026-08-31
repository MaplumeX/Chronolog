# PRD：分类 / 标签页面 UI 重设计

## Goal

将 `CategoriesPage` / `TagsPage` 从「顶部工具行 + table-in-card 扁平表格」重设计为现代树形布局，同时统一两页的重复孪生代码（约 200 行 × 2 → 一个共享组件 + 两份薄配置）。用户价值：层级关系一目了然、删除交互统一、后续功能（折叠/搜索等）有统一的扩展载体。

## Background（现状事实）

- `web/src/pages/CategoriesPage.tsx`（~190 行）与 `web/src/pages/TagsPage.tsx`（~200 行）几乎复制粘贴；差异仅：
  - 分类删除：`disabled={entryCount > 0}`（占用时禁用，409 原因放 `title`）；
  - 标签删除：行内两步确认（删除 → 确认删除？）；
  - API 集合不同（`api.categories/tags/createCategory/createTag/...`，见 `web/src/api.ts`）。
- 层级：两级（`parentId` 指向顶层节点），排序/父级选择来自 `web/src/hierarchy.ts`（`sortHierarchical` / `topLevel`）。
- 共享组件已存在：`AddChildPopover`、`NameColorEditPopover`（名称+8 色板+父级选择）、`ColorPalettePicker`。
- 颜色契约（design-tokens.md）：`paletteColor(color, name)`；`categoryIndex` hash 逻辑不可改；创建即固定色（`categoryIndex(name)+1` 落库）。
- 设计语言：Linear 风轻卡片（hairline border + `shadow-xs` + `rounded-lg`），`PageContainer wide`。
- 测试体系（commit a69ae37）：vitest + RTL，`web/src/test/setup.ts` 全局初始化 i18n 并 pin `en`；radix portal 泄漏需手动清理 body（见 `CategoryPicker.test.tsx` 惯例）。
- 每行操作按钮现在常驻显示；记录数列头 `categories/tags.entryCount`。

## Key Decisions（用户已确认）

- **D1 树形布局形态 = 方案 A「树形卡片列表」**：单张轻卡片承载整棵树，父行带 chevron 折叠/展开（默认展开），子行缩进 + 竖向 guide line；行 hover 显示操作按钮；去掉表格头。
- **D2 删除交互统一 = 行内两步确认 + 分类保留禁删**：所有删除按钮先点变「确认删除？」再点执行（项目惯例，Tags/Goals/EntryEditor 同款）；分类 `entryCount > 0` 时按钮禁用 + `title` 说明（后端 409 约束）；父节点删除的级联提示（`deleteCascadeTitle`）保留。

## Requirements

### R1 共享树形列表组件

- 抽取泛型共享组件（如 `HierarchicalListCard`），分类页与标签页各持薄配置（API 适配 + 差异项：分类的禁删逻辑）。
- 组件承载：创建（顶部工具行 Input+按钮）、树形渲染、编辑/加子级/删除操作、错误提示。
- `AddChildPopover` / `NameColorEditPopover` / `ColorPalettePicker` / `hierarchy.ts` 原样复用，不破坏其 props 契约。

### R2 树形 UI 重设计

- 单张轻卡片内树形呈现：父行（chevron + 色点 + 名称 + 记录数 + 操作）+ 缩进子行（`pl-6` + 竖向 guide line 视觉语言延续）。
- 折叠/展开能力，默认展开；折叠态父行仍可操作。
- 视觉遵循 design-tokens：轻卡片、语义 token、`paletteColor` 色点、type scale（正文 `text-sm`、元信息 `text-xs text-muted-foreground`）。
- 行 hover 显示操作按钮（添加子级 / 编辑 / 删除）。
- 空状态有引导文案（zh/en i18n）。

### R3 删除交互统一（按 D2）

- 两页统一行内两步确认；分类占用禁删保留；级联提示保留。

### R4 验收

- 功能回归：创建顶层/子级、改名/改色/改父级、删除（含级联、含占用禁删）行为与现状一致。
- i18n zh/en 全量 key 覆盖新 UI 文案。
- 现有测试通过；`npm run build` / `npm run test` 通过。

## Out of Scope

- 后端 API 变更；拖拽排序/拖拽换父级；搜索过滤；多级（>2 层）层级。
- Goals / Tokens 页表格改动（它们保持 table-in-card）。

## Acceptance Criteria

- AC1：分类/标签页渲染为共享组件驱动的树形布局，代码无孪生重复。
- AC2：折叠/展开可用且默认展开；层级视觉（缩进+guide line）清晰；操作按钮 hover 显示。
- AC3：全部 CRUD 操作（含级联删除、占用禁删）行为与重设计前一致。
- AC4：zh/en 文案齐全；`npm run build`、`npm run test` 通过。
