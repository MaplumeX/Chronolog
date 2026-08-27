# Implement: CLI/Agent token 认证（PAT + Bearer）

## 执行清单（顺序）

### 后端

1. **schema + 建表**
   - [ ] `server/src/schema.ts`：新增 `apiTokens` 表（见 design.md 数据模型）
   - [ ] `server/src/db.ts`：`SCHEMA_SQL` 追加 `api_tokens` 的 `CREATE TABLE IF NOT EXISTS` + 两个索引
2. **认证层**
   - [ ] `server/src/auth.ts`：新增 `hashToken(token)`（sha256 hex）与 `newToken()`（`ctt_` + base64url 32字节）；`loadUser()` 增加 Bearer 分支（解析 `Authorization` 头 → 哈希查表 → 命中返回用户并更新 `lastUsedAt`）
3. **管理路由**
   - [ ] 新增 `server/src/routes/tokens.ts`：`POST /api/tokens`、`GET /api/tokens`、`DELETE /api/tokens/:id`（契约见 design.md；name 校验 1–64 字符）
   - [ ] `server/src/app.ts`：注册 tokens 路由

### 测试

4. **服务端测试**（新增 `server/test/tokens.test.ts`，参考 `auth.test.ts` / `helpers.ts`）
   - [ ] 创建 token 返回明文，库中仅存哈希（直接查 sqlite 验证）
   - [ ] Bearer token 访问 `/api/auth/me` 成功；无效/撤销后 401
   - [ ] cookie 认证不受影响（已有测试回归覆盖）
   - [ ] name 缺失/超长 → 400；删除不存在的 id → 404
   - [ ] lastUsedAt 在 Bearer 认证后被更新

### 前端

5. **api 与导航**
   - [ ] `web/src/api.ts`：`ApiToken` 类型 + `createToken / tokens / deleteToken`
   - [ ] `web/src/components/Shell.tsx`：NAV 增加 tokens 项（KeyRound 图标）；`web/src/App.tsx` 增加 page 分支与 header title
6. **TokensPage**
   - [ ] 新增 `web/src/pages/TokensPage.tsx`：列表 Table（name/createdAt/lastUsedAt/撤销确认）、内联创建表单、创建后一次性明文展示弹层（复制按钮 + 警告文案），参考 `TagsPage.tsx`
7. **i18n**
   - [ ] `web/src/i18n/locales/zh.ts` / `en.ts`：`nav.tokens` + tokens 页全部文案

## 验证命令

```bash
npm test -w server          # 全部 server 测试（含新增 tokens.test.ts）
npm run typecheck           # server + web
cd web && npm run build     # 前端构建冒烟（如脚本存在）
```

## 风险文件与回滚点

- `server/src/auth.ts` 的 `loadUser()` 是热路径，改动最小化：仅在存在 `Authorization` 头时走新分支
- 每完成"后端 + 测试"可作为一个回滚点（后端可独立合入）；前端改动独立无风险
- 回滚方式：git revert；残留 `api_tokens` 表无害

## start 前检查

- [ ] prd.md / design.md / implement.md 已评审
- [ ] implement.jsonl / check.jsonl 已填入真实条目（非 seed）
- [ ] 用户已明确批准规划摘要