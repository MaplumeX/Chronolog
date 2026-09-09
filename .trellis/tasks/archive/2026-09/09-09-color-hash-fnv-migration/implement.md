# 执行计划

前置：阅读 `.trellis/spec/frontend/design-tokens.md`（颜色契约）与 `component-guidelines.md` 相关段落。

## 阶段 1 — 服务端（hash 工具 + 迁移 + 默认分类）

- [x] 1.1 新建 `server/src/color-hash.ts`：FNV-1a `categoryIndex`（0–7），注释指向前端 `web/src/format.ts`
- [x] 1.2 `server/src/db.ts` `migrate()` 末尾追加 NULL 固化（categories + tags，单事务，幂等）
- [x] 1.3 `server/src/routes/auth.ts` 注册默认分类补 `color: categoryIndex(name) + 1`
- [x] 1.4 新建 `server/test/color-hash.test.ts`：已知向量（与前端同批）+ 迁移固化/幂等/已设色不变
- [x] 1.5 验证：`cd server && npm test` 全绿

## 阶段 2 — 前端（hash 替换 + 注释 + 测试）

- [x] 2.1 `web/src/format.ts`：`categoryIndex` 换 FNV-1a；更新两处「不可改动」注释为新契约（指向服务端固化迁移）
- [x] 2.2 `NameColorEditPopover.tsx`：更新 `initialColor` 注释（逻辑不动）
- [x] 2.3 `web/src/format.test.ts`：hash 用例换已知向量锚定（与服务端测试同批名称）
- [x] 2.4 验证：`cd web && npm test` 全绿 + `npm run build` 通过

## 阶段 3 — 收尾

- [x] 3.1 spec 更新：`design-tokens.md` 颜色契约段——移除「hash 逻辑不可改动」，写入 FNV-1a、服务端固化迁移、双实现锚定约定
- [x] 3.2 对照 PRD 验收标准逐条核对
- [ ] 3.3 commit（英文 message）并跑 trellis-finish-work

## 验证命令

```bash
cd server && npm test
cd web && npm test && npm run build
```

## 回滚点

- 阶段 1、2 各自独立可 revert；固化后的 color 值为合法显式色，回滚代码无需清理数据。
