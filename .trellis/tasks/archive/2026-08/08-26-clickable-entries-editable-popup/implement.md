# 时间线条目可点击编辑（popover）— 执行计划

## 实施清单（按序）

### 后端

1. `server/src/routes/entries.ts`：新增 `registerEntryRoutes`，实现 `PATCH /api/entries/:id`（校验顺序见 design.md）。
2. `server/src/app.ts`：注册 `registerEntryRoutes`。
3. `server/test/entries.test.ts`：新增测试：
   - 编辑描述/分类/标签成功，返回更新后的 entry（含 tags）。
   - 编辑起止时间成功，today/week 列表反映新位置与时长。
   - 非本人条目 → 404；不存在的条目 → 404。
   - 运行中条目 → 409。
   - 分类/标签不存在或非本人 → 404。
   - stoppedAt <= startedAt → 400；描述超长 → 400。
   - 与已停止条目重叠 → 409；与运行中条目重叠 → 409；边界相接（==）不冲突。
   - 编辑后旧标签被替换（删除 + 新增）。

### 前端

4. `web/src/components/ui/popover.tsx`：shadcn 风格 Radix Popover 封装（Root/Trigger/Content/Anchor）。
5. `web/src/api.ts`：`updateEntry(id, body)` → `PATCH /api/entries/:id`。
6. `web/src/components/EntryEditor.tsx`：popover 内容表单（描述/分类/标签/起止时间/时长展示/保存/取消/错误）。
7. `web/src/components/Timeline.tsx`：block 点击 → 选中；`Popover.Anchor` 包裹选中 block；运行中 block 不可点击；渲染 `EntryEditor`。
8. `web/src/pages/TimerPage.tsx`：传 categories/tags 给 Timeline；`onEntryUpdated` 刷新 today/week 并关闭 popover。
9. `web/src/i18n/locales/zh.ts` + `en.ts`：新增文案。

## 验证命令

```bash
cd server && npm test          # 后端全部测试（含新增 entries.test.ts）
cd server && npm run typecheck
cd web && npm run typecheck
cd web && npm run build        # tsc + vite build
```

## 风险点 / 回滚点

- 重叠校验 SQL 是核心逻辑，测试必须覆盖边界相接与运行中条目冲突。
- Radix Popover 的 Anchor 必须在 Root 组件子树内（Timeline 顶层放 Root，DayColumn 内放 Anchor）。
- 保存后刷新：`TimerPage.refreshEntries` 只刷新 today/week，不要重置开始计时表单（categoryId/description/tagIds）。
- 回滚点：每个 commit 独立可回滚；后端接口与前端组件分开提交。

## 提交前检查

- [ ] 后端测试全绿（`npm test`）
- [ ] 前后端 typecheck 通过
- [ ] web build 通过
- [ ] 手动验证：day/week 点击、运行中不可点、编辑保存、重叠 409 提示、中英文文案
