# 技术设计：分类/标签色板配色编辑

## 总体思路

给 `categories` / `tags` 表加可空整数列 `color`（存色板索引 1–8），API 全链路透传；前端展示处改为"优先显式色、回退 hash 色"。色板本身（`--category-1..8` 及前景色、light/dark 两套）不变，仍是唯一色值定义处。

## 后端

### Schema / 迁移

- `server/src/schema.ts`：`categories`、`tags` 各加 `color: integer("color")`（可空）。
- `server/src/db.ts`：
  - `SCHEMA_SQL` 的两张表加 `color INTEGER`（新库）。
  - `migrate()` 扩展：检测 `categories` / `tags` 缺 `color` 列时执行 `ALTER TABLE ... ADD COLUMN color INTEGER`（旧库，幂等，模式与 display_name 一致）。

### 路由（categories.ts / tags.ts）

- 新增共享校验：

  ```ts
  const colorField = z.number().int().min(1).max(8).nullable().optional();
  ```

  - 创建 body：`{ name, color? }`；`color` 为 `null` 或缺省 → 存 NULL。
  - PATCH body：`{ name?, color? }`，允许只改颜色（name 可选）。保持现有重名冲突逻辑不变。
  - 注意：现有 PATCH 要求 name 必填；改为 name/color 均可选、至少其一，避免"只想改颜色还必须传名字"。
- GET 返回值在现有字段上追加 `color: number | null`。
- 错误：非法 color 由 zod → 400 VALIDATION（parseBody 现有机制）；ownership 404 不变。

### 相关读取路径

- `server/src/entries.ts` 的 `EntryDto.tags` / `categoryName`：**不改**。条目 DTO 不带颜色——前端已持有分类/标签列表（含 color），展示时按 id/name 查表即可，避免 join 膨胀。
  - 例外确认：Timeline/Stats 的 tag 颜色目前用 `categoryColor(tag.name)`（hash），改为按 tagId 查前端缓存的 color，无 color 回退 hash——不需要后端配合。
- 统计接口（`stats-range` 等）聚合里也不加 color（理由同上）。

## 前端

### API 层（web/src/api.ts）

- `Category` / `Tag` 类型加 `color: number | null`。
- `createCategory(name, color?)`、`renameCategory` 保留并加可选 color；考虑语义改为 `updateCategory(id, { name?, color? })`（tags 同理），与后端 PATCH 对齐。

### 颜色工具（web/src/format.ts）

- 保留 `CATEGORY_VARS`、`categoryIndex`、`categoryColor`（hash 回退，逻辑不动）。
- 新增：

  ```ts
  export function paletteColor(color: number | null | undefined, fallbackName: string): string {
    return color ? `var(--category-${color})` : categoryColor(fallbackName);
  }
  export function paletteForegroundColor(color: number | null | undefined, fallbackName: string): string { ... }
  ```

- Timeline 的 `--category-${idx+1}-foreground` 用法改为 `paletteForegroundColor`。

### UI

- `CategoriesPage` / `TagsPage`：
  - **创建保持现状**：输入框 + 添加按钮，POST 不带 color（自动 hash 色），UI 不加色板。
  - **行内编辑改造**：现有「重命名」行内展开（setEditing + Input）改为「编辑」按钮，点击弹出浮窗（优先复用 `ui/popover` 或 `ui/dialog`，看组件库已有哪些）；浮窗内含名称 Input + 色板（8 色点 + 「自动」）。
  - 色板选中态：描边/勾选标识；色点底色用对应 `--category-N`。
  - 表格行内色点用 `paletteColor(c.color, c.name)`。
- 展示组件（`Timeline.tsx`、`StatsPage.tsx`、`CategoryPicker.tsx`、`TagPicker.tsx`、`TimerBar.tsx`）：
  - 分类条目色：从该组件已有的分类列表/条目 categoryId 查 color；没有列表可查的地方（如 StatsPage 的 categories 聚合返回只有 categoryName）需要确认数据来源。
  - tag 色：按 tagId 从 tags 列表查。
  - 数据来源不足处（stats 聚合只有 name）：先查该 name 对应分类的 color（管理列表在全局 store/缓存中）——若页面已加载分类列表则查；否则回退 hash。实现时以最小改动为原则，允许个别位置暂时回退 hash 色。

### i18n

- zh/en 补 key：`categories.color` / `categories.colorAuto` / `tags.color` / `tags.colorAuto`（或复用 common）。

## 权衡与备选

- **存色板索引 vs 存色值字符串**：选索引。索引天然绑定 CSS 变量双主题自适应，存储/校验简单；存色值则需要前端维护色值列表且丢失主题适配。
- **条目 DTO 是否带 color**：不带，前端查表，避免 join 与缓存失效复杂度。
- **PATCH name 必填 → 可选**：是行为变化，但向后兼容（老客户端传 name 仍合法）。

## 回滚

- 后端列是可空新增，前端未传 color 时行为与现状一致；回滚 = 前端还原即可，DB 列无害保留。
