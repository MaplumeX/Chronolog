# 实施计划：分类/标签色板配色编辑

按层推进，每步有验证点；后端先行，前端跟进。

## Checklist

### A. 后端

- [ ] A1 `server/src/schema.ts`：categories / tags 加 `color` 可空列。
- [ ] A2 `server/src/db.ts`：SCHEMA_SQL 两表加 `color INTEGER`；`migrate()` 加幂等 `ALTER TABLE`（模式对齐 display_name）。
- [ ] A3 `server/src/routes/categories.ts`：
  - GET 返回 `color: number | null`；
  - POST body 加可选 `color`（1–8 int，null 视为未设置；前端创建流程不传，但 API 保留能力）；
  - PATCH body 改为 name/color 均可选（至少其一），返回体含 color。
- [ ] A4 `server/src/routes/tags.ts`：同 A3。
- [ ] A5 测试 `server/test/categories.test.ts`（如不存在则新建/加入现有相关测试文件）：
  - POST 带 color 持久化；PATCH 只改 color；PATCH 非法 color → 400；GET 回读 color；默认 NULL。
  - tags 同套断言。
- [ ] 验证：`npm test -w server && npm run typecheck -w server`。

### B. 前端

- [ ] B1 `web/src/api.ts`：Category/Tag 类型加 `color: number | null`；create/update API 支持 color（renameCategory/renameTag 语义扩展为 update）。
- [ ] B2 `web/src/format.ts`：新增 `paletteColor(color, fallbackName)` / `paletteForegroundColor(color, fallbackName)`；不动 hash 逻辑。
- [ ] B3 `web/src/pages/CategoriesPage.tsx`：「重命名」行内展开改为「编辑」浮窗（名称 Input + 8 色色板 + 自动）；行内色点用 paletteColor；创建保持输入框+添加不动。
- [ ] B4 `web/src/pages/TagsPage.tsx`：同 B3。
- [ ] B5 展示位替换（用 paletteColor + 组件已有的分类/标签列表查 color，查不到回退 hash）：
  - `Timeline.tsx`（条目块前景色 + tag 色点）
  - `StatsPage.tsx`（图例/条形/饼图/tag 过滤）
  - `CategoryPicker.tsx` / `TagPicker.tsx` / `TimerBar.tsx`
- [ ] B6 i18n zh/en 补色板相关文案 key。
- [ ] 验证：`npm run typecheck -w web && npm run build -w web`。

### C. 收尾

- [ ] C1 全量 `npm run typecheck && npm test`。
- [ ] C2 手动/子代理检查：旧数据（color 全 NULL）下视觉与现状一致；设定色后各展示位生效。
- [ ] C3 spec 更新（trellis-update-spec）+ commit（conventional commit）。

## 验证命令

```bash
npm run typecheck
npm test -w server
npm run build -w web
```

## 回滚点

- 每个 checklist 大项（A / B）独立可回滚；A 为向后兼容的可空列新增，不破坏旧客户端。
