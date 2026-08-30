# 分类/标签色板配色编辑

## 背景

当前分类与标签的颜色由名称 hash 分配到 8 色 CSS 色板（`--category-1..8`，light/dark 各一套），用户无法自定义。用户希望能在**内置色板**（即现有 8 色）中为每个分类/标签选择颜色，不需要自由取色器。

## 需求

1. 每个分类、每个标签可以独立指定一个内置色板颜色（1–8）。
2. 未指定颜色时，保持现状：按名称 hash 回退到色板索引（既有映射不变）。
3. **创建交互不变**：保持现有“输入框 + 添加按钮”，创建时自动分配颜色（即未指定，走 hash 回退），不出现色板。
4. **编辑交互**：行内“重命名”按钮改为“编辑”按钮，点击弹出浮窗（Popover 或 Dialog），浮窗内可同时调整名称和颜色；颜色为 8 色色板 + “自动”（未指定）选项。
4. 所有展示位置（Timeline、统计页、CategoryPicker、TagPicker、TimerBar、分类/标签管理页）优先使用用户设定的颜色，未设定时使用 hash 回退色。
5. 色板就是现有 `--category-1..8`（含 light/dark 两套与前景色），不新增色值。

## 约束

- 数据库迁移必须幂等（复用 db.ts 的列迁移机制），已有数据 color 为 NULL、行为不变。
- 颜色校验：只接受 1–8 的合法索引（或 NULL/自动），非法值返回 400 VALIDATION。
- 跨用户隔离沿用现有 ownership 校验（404 NOT_FOUND）。
- hash 回退逻辑不可改动（`format.ts` 中已有注释明确该约束）。
- 双端类型同步：server/web 的类型与 API 契约一致（遵循 cross-layer 指南）。
- 中英文案（i18n zh/en）同步补齐。

## 验收标准

- [ ] `categories` / `tags` 表新增可空 `color` 列（幂等迁移），旧库升级后无颜色行为与升级前一致。
- [ ] `POST /api/categories`、`POST /api/tags` 支持可选 `color`；`PATCH /api/categories/:id`、`PATCH /api/tags/:id` 支持可选 `color`（可与 name 同时改，也可单独改）。
- [ ] `GET /api/categories`、`GET /api/tags` 返回 `color`（number | null）。
- [ ] 非法颜色（0、9、"red"、负数）返回 400。
- [ ] 分类/标签管理页：「重命名」改为「编辑」，弹出浮窗（名称输入 + 8 色色板 + 自动选项）；保存后立即生效。创建仍为输入框+添加按钮，无色板。
- [ ] Timeline、统计页、选择器、计时条展示位置使用用户设定色；未设定时保持 hash 回退色（视觉与升级前一致）。
- [ ] `npm run typecheck` 与 `npm test`（server）全部通过。
- [ ] 新增后端测试覆盖：颜色校验、CRUD 持久化、未设定回退。
