# 执行计划：完善用户系统

## 前置

- 分支：`feat/user-system`（已切好）
- 验证命令：`npm run typecheck`（根目录，覆盖 server+web）、`npm test -w server`

## 执行清单（按序）

### Step 1 — 后端：schema + 迁移

- [ ] `server/src/schema.ts`：`users` 表增加 `displayName: text("display_name")`（可空）
- [ ] `server/src/db.ts`：
  - `SCHEMA_SQL` 的 `CREATE TABLE users` 语句补 `display_name TEXT`
  - `openDb` 在 `exec(SCHEMA_SQL)` 后用 `PRAGMA table_info(users)` 检查并幂等 `ALTER TABLE users ADD COLUMN display_name TEXT`
- 验证：`npm run typecheck -w server` 通过

### Step 2 — 后端：Deps 注入 registrationOpen

- [ ] `server/src/db.ts` `Deps` 增加 `registrationOpen: boolean`
- [ ] `server/src/index.ts` 读取 `process.env.REGISTRATION_OPEN !== "false"` 传入
- [ ] `server/src/app.ts` `AppConfig` 增加字段并透传给 Deps
- [ ] `server/test/helpers.ts` `buildApp` 调用补上默认 `registrationOpen: true`
- 验证：typecheck + `npm test -w server`（既有测试不回归）

### Step 3 — 后端：注册控制 + me 增强

- [ ] `routes/auth.ts`：register 开头检查 `!deps.registrationOpen` → 403 `FORBIDDEN`「注册已关闭」
- [ ] `auth.ts`：`AuthUser` 类型 + `loadUser` 两个分支返回 `displayName`（string | null）
- [ ] `routes/auth.ts` register/login/me 响应带 `displayName`
- 验证：`server/test/auth.test.ts` 增补断言（me 含 displayName、REGISTRATION_OPEN=false 时 403）

### Step 4 — 后端：account 路由

- [ ] 新建 `server/src/routes/account.ts`：
  - `PATCH /api/profile`：username（可选，注册规则）/ displayName（可空，0–32 trim）；409 唯一冲突；400 空更新
  - `PATCH /api/account/password`：验证 currentPassword（错→401），更新 hash 后删除其他 sessions（Bearer 请求则删全部）
  - `DELETE /api/account`：验证 password（错→401），删用户（级联），`clearSessionCookie`，返回 `{ ok: true }`
  - `GET /api/meta`（公开）：`{ registrationOpen }`
- [ ] `app.ts` 注册 `registerAccountRoutes`
- 验证：typecheck 通过

### Step 5 — 后端：测试

- [ ] 新建 `server/test/account.test.ts`：
  - profile：更新 username/displayName 成功；409 重复用户名；400 非法用户名/超长昵称/空更新；me 反映更新
  - 改密码：错误旧密码 401；成功后新密码可登录；旧 cookie 401、当前 cookie 有效；PAT 不受影响（改密码前后 Bearer 请求均 200）
  - 注销：错误密码 401；成功后旧 sid 401；用户相关数据（categories/tokens）不可见；重新注册同名用户可行
  - meta：`registrationOpen` 与 env 一致（helper 传 false 建一个 app 验证 403）
- [ ] `auth.test.ts` 增补：displayName in me / register 403
- 验证：`npm test -w server` 全绿
- **Review gate**：此处建议先 commit 后端部分再进前端

### Step 6 — 前端：api client + 设置页

- [ ] `web/src/api.ts`：`User` 加 `displayName`；新增 `meta()`、`updateProfile`、`changePassword`、`deleteAccount`
- [ ] 新建 `web/src/pages/SettingsPage.tsx`（资料区 / 改密码区 / 注销 dialog，风格对齐 TokensPage）
- [ ] `web/src/App.tsx`：PageId 加 `settings`，路由渲染 SettingsPage；profile 保存后同步 `setUser`；注销成功后 `setUser(null)`
- [ ] `web/src/components/Shell.tsx`：footer username 条目改为可点击进入 settings；显示 displayName ?? username；传入新 props
- [ ] `AuthPage.tsx`：加载 `api.meta()`，registrationOpen=false 时禁用注册 tab + 提示文案
- [ ] i18n `zh.ts` / `en.ts`：settings.*、auth.registrationClosed 等 key 双语补齐
- 验证：`npm run typecheck`（server+web 全绿）

### Step 7 — 全量验收

- [ ] 手动验收清单（对照 prd.md Acceptance Criteria）
- [ ] `npm test -w server` + `npm run typecheck` 最终全绿
- [ ] 派发 trellis-check（axonhub/glm-5.3-flash, thinking high）做最后全范围检查

## 回滚点

- Step 5 后 commit（后端可独立回滚）
- Step 7 后 commit（整体 revert 即回滚，SQLite 多列无害）

## 实现分工

- Step 1–6 派发 trellis-implement sub-agent（模型 axonhub/glm-5.3-flash，thinking high），每批步骤一次派发
- Step 7 的检查派发 trellis-check sub-agent（同模型）