# 色板去除自动选项，创建即固定颜色

## 背景

上一任务（08-30-category-tag-color-palette）实现了分类/标签的色板配色编辑，但色板 UI 含「自动」选项（color 保持 null，展示时回退名称 hash）。用户澄清需求：**「自动」不应是一个可保存的状态**，它只是创建时的默认值生成逻辑。

## 需求

1. **创建即固定**：新建分类/标签时，按名称 hash 生成色板索引（1–8）并作为 `color` 直接存库。新建项天生有确定颜色。
2. **编辑无「自动」**：编辑浮窗的色板为 8 个色点必选其一（无自动胶囊按钮），始终恰有一个实选色点 = 当前生效色。
3. **改名不重新 hash**：颜色已落库固定，编辑浮窗里改名称不会改变色板选中态。
4. **旧数据兼容**：存量 color 为 NULL 的项，展示仍回退 hash 色（视觉不变）；在编辑浮窗中打开时，默认选中其 hash 回退色，保存时固化落库。
5. 后端 API 无行为变更（color 可空、校验、PATCH 语义均不动）。

## 验收标准

- [ ] `ColorPalettePicker` 无「自动」选项，8 色点单选必选其一；props 变为 `value: number`（非 null）。
- [ ] 创建分类/标签：POST 携带 `color = categoryIndex(name) + 1`（hash 索引），入库即固定。
- [ ] 编辑浮窗：改名时色板选中态不变；换色点保存后颜色更新。
- [ ] 旧数据（color = NULL）：编辑浮窗打开默认选中 hash 回退色；保存后 color 落库；未编辑的旧数据展示位仍回退 hash 色。
- [ ] i18n：移除不再使用的 `common.colorAuto` 等 key（zh/en 同步，检查无残留引用）。
- [ ] `npm run typecheck`、`npm test -w server`、`npm run build -w web` 全绿。

## 约束

- 不改 hash 逻辑（`categoryIndex`）。
- 不改后端路由/校验/迁移。
- 色点只用 `var(--category-N)` token。
