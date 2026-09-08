# Implement：相邻条目合并

执行顺序即依赖顺序；每步后跑对应验证命令。

## 阶段 1：后端

- [ ] 1.1 `server/src/entries.ts`：新增 `mergeEntries(db, userId, id, direction, keep)` 核心函数（事务内：所有权/运行中/相邻性校验 + update keep 条时间 + delete other 条，复用 `checkOverlap` 兜底逻辑思路）。
- [ ] 1.2 `server/src/routes/entries.ts`：注册 `POST /api/entries/:id/merge`（zod body：direction/keep 枚举；`requireUser` + `parseBody`；返回 `{ entry: getEntry(...) }`）。
- [ ] 1.3 `server/test/entries.test.ts`：新增合并测试组——
  - prev/next 双向合并（AC1/AC2）
  - keep = self / other 两种属性来源（AC1/AC2）
  - 跨空隙合并（AC3）
  - self 或相邻条运行中 → 409（AC4，两方向）
  - 中间隔第三条 → 409（AC5）
  - 跨用户条目 id → 404（AC5）
  - 被并入条的 entry_tags 清理（AC7）
- [ ] 1.4 验证：`npm run typecheck -w server && npm test -w server`

## 阶段 2：前端

- [ ] 2.1 `web/src/api.ts`：`mergeEntry(id, { direction, keep })`。
- [ ] 2.2 `web/src/i18n/locales/{zh,en}.ts` + `i18next.d.ts`：合并相关文案（AC6）。
- [ ] 2.3 `web/src/components/MergeDialog.tsx`：新建合并确认对话框（两条预览卡二选一、合并区间预览、错误内联重试）。
- [ ] 2.4 `web/src/components/EntryEditor.tsx`：编辑模式操作区新增「与上一条合并」「与下一条合并」按钮；接收相邻候选 props（`prevEntry` / `nextEntry`，可 null）；按钮禁用态处理（候选缺失或当前条运行中）。
- [ ] 2.5 `web/src/components/Timeline.tsx`：计算相邻候选（视图内排序 + boundary 数据），传入 EntryEditor；合并成功复用 `onEntryUpdated` 刷新。
- [ ] 2.6 `web/src/components/Timeline.test.tsx`（或新建 MergeDialog 测试）：覆盖打开对话框 → 选择来源 → 确认 → api 调用参数正确 → 成功后刷新（AC7）。
- [ ] 2.7 验证：`npm run typecheck -w web && npm test -w web`

## 阶段 3：收尾

- [ ] 3.1 全量验证：`npm run typecheck -w server -w web && npm test -w server -w web`（或分别跑）。
- [ ] 3.2 手动冒烟（可选）：docker compose 起本地环境验证 UI 流程。
- [ ] 3.3 spec 更新评估：若新增「写操作服务端重判相邻性」等模式值得沉淀，更新 `.trellis/spec/backend/http-routes.md` 或 frontend 组件规范。
- [ ] 3.4 commit（conventional：`feat: add entry merge with adjacent entry (#NN)`）。

## 风险与回滚

- 触碰文件集中在 entries 路由/逻辑 + EntryEditor/Timeline，均为增量改动，回滚 = revert 单 commit。
- 事务内先 delete 后 checkOverlap 的顺序注意：合并区间包含被删条目，必须先删/或排除两 id 后再校验，否则误报 OVERLAP（实现时按 design §2.3-2.4 顺序）。

## task.py start 前检查

- [x] prd.md 收敛（无未决问题）
- [x] design.md、implement.md 就绪
- [ ] implement.jsonl / check.jsonl 已填充真实 spec 条目
- [ ] 用户已批准最终规划摘要
