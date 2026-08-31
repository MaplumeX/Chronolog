# PRD：条目删除与分类/标签删除改为弹窗确认

## 背景

当前"删除"确认有两种行内两步确认（首点变"确认删除？"再点执行）：

- `EntryEditor.tsx`（时间条目编辑弹层内）— `confirmingDelete` 状态
- `HierarchicalListCard.tsx`（分类/标签树形列表行内）— `confirmingId` 状态

用户希望统一改为**弹窗（modal dialog）确认**。项目已有 shadcn `Dialog` 基元（`GoalEditorDialog`、Settings 删除账户确认均使用）。

## 范围

**改**：
1. **时间条目删除**（`EntryEditor` 编辑模式，`Timeline` popover 内）
2. **分类/标签删除**（`HierarchicalListCard`，Categories/Tags 两页共用）

**不改**：
- Goals 删除（保持行内两步确认，本次范围外）
- Settings 删除账户 / Token 撤销（已是 Dialog 或范围外）
- 后端 API、禁删规则、级联规则（`deleteDisabled`、409 引用保护等逻辑保持不变）
- 删除的 API 调用与错误处理路径（失败文案仍由页面壳 / EntryEditor 展示）

## 需求

### R1 共享确认弹窗组件
新建一个可复用的确认弹窗组件（如 `web/src/components/ConfirmDialog.tsx`），基于 shadcn `Dialog`（fade-only 动画，遵守 spec 的 dialog 动画约束）。Props 至少包含：open / onOpenChange / 标题 / 描述文案（支持插值如子级数量）/ 确认与取消文案 / 删除中（pending）状态 / destructive 确认按钮。

### R2 时间条目删除改弹窗
`EntryEditor` 编辑模式的删除按钮（`mr-auto` ghost 红字）点击后不再进入行内确认态，而是打开确认弹窗；弹窗确认后执行 `api.deleteEntry`，成功复用 `onSaved()`。删除中禁用弹窗按钮，失败错误文案展示在编辑器内（现状行为）。草稿（draft）模式不渲染删除按钮（现状保持）。

### R3 分类/标签删除改弹窗
`HierarchicalListCard` 行内删除按钮点击后打开确认弹窗（同一时间最多一个）。弹窗描述需携带级联信息：删除父级时提示"将同时删除 N 个子级"（复用现有 `deleteCascadeTitle` 文案或迁移为弹窗描述）。禁删规则不变：`deleteDisabled` 的行删除按钮仍 disabled + title 提示。删除失败时错误文案仍由页面壳展示（组件内 `.catch(() => {})` 兜底保持）。

### R4 i18n
所有新增文案进 `web/src/i18n/locales/zh.ts` + `en.ts`（如弹窗标题/描述/取消/确认删除键）。可清理不再使用的行内确认键（`entry.confirmDelete`、`categories.confirmDelete`、`tags.confirmDelete`），保留仍被 Goals 使用的 `goals.confirmDelete`。i18n key 命名跟随现有 namespace 惯例。

### R5 测试
更新/新增组件测试（`HierarchicalListCard.test.tsx` 现有两步确认用例改为弹窗交互断言；`EntryEditor` 如无现有测试则按项目测试惯例补关键用例）。全量前端测试通过。

## 验收标准

- AC1：条目编辑弹层点"删除"→ 出现确认弹窗（含条目信息或删除警告文案），点"取消"或按 Esc/点遮罩关闭后不删除，编辑器保持打开。
- AC2：弹窗内点确认 → 执行删除，成功后 popover 关闭并刷新时间线；失败时错误文案可见且弹窗可重试/关闭。
- AC3：分类/标签行点"删除"→ 出现确认弹窗；删除带子级的父级时弹窗内明确提示将同时删除的子级数量。
- AC4：`deleteDisabled`（分类有记录）的行删除按钮仍禁用且带 title 提示，点击不弹窗。
- AC5：一次只存在一个确认弹窗；对 A 行打开弹窗后不会影响 B 行。
- AC6：zh/en 双语文案齐全，无硬编码 UI 文案；`npm run check`（或项目等价 lint/typecheck/test 命令）全部通过。
- AC7：Goals 删除、Settings 删除账户行为不受影响（回归）。

## 非目标

- 不做软删除/回收站/撤销。
- 不改后端删除语义。
