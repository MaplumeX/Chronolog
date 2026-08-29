# 技术设计：完善用户系统

## 1. 数据层

### schema 变更（`server/src/schema.ts`）

`users` 表新增可空列：

- `display_name TEXT`（无唯一约束；空值时 UI fallback 到 username）

### 迁移策略（`server/src/db.ts`）

项目无迁移系统，`SCHEMA_SQL` 用 `CREATE TABLE IF NOT EXISTS`。在 `openDb` 的 `sqlite.exec(SCHEMA_SQL)` 之后追加幂等 ALTER：

```sql
ALTER TABLE users ADD COLUMN display_name TEXT;
```

用 `PRAGMA table_info(users)` 检查列是否已存在，不存在才执行 ALTER（SQLite 的 `ADD COLUMN` 无 IF NOT EXISTS）。`SCHEMA_SQL` 中同步把新列写进 `CREATE TABLE users` 语句，保证全新库与旧库结构一致。

注意：现有表创建用了 `COLLATE NOCASE`（在列上），schema.ts 的 drizzle 定义没有 NOCASE——保持现状不动（精准修改原则），只在 drizzle 定义补 `displayName`。

### Deps 变更

`Deps` 新增 `registrationOpen: boolean`（来自 `process.env.REGISTRATION_OPEN !== "false"`，默认开）。`index.ts` 读取后传入 `buildApp` → `AppConfig`。

## 2. 后端路由

新增 `server/src/routes/account.ts`，承载用户系统扩展端点；auth.ts 只加 `me` 增强。

### 端点一览

| 端点 | 方法 | 认证 | 说明 |
|---|---|---|---|
| `/api/auth/me` | GET | cookie/Bearer | 响应增加 `displayName`（可 null） |
| `/api/profile` | PATCH | requireUser | `{ username?, displayName? }`，返回更新后 user |
| `/api/account/password` | PATCH | requireUser | `{ currentPassword, newPassword }` |
| `/api/account` | DELETE | requireUser | `{ password }` 确认后删除账户 |

### 行为细节

**PATCH /api/profile**
- `username`：可选，但传入时按注册规则校验（3–32 位 `[A-Za-z0-9_]`）；唯一冲突 409 `CONFLICT`（复用 `isUniqueViolation`）
- `displayName`：可空字符串→存 NULL；传入时 trim 后 0–32 字符（空 = 清除昵称）；超出范围 400
- 至少一个字段存在，否则 400
- Bearer PAT 也可调用（与现有 tokens 管理一致，PAT 拥有完整权限，见 auth.md spec）

**PATCH /api/account/password**
- `{ currentPassword, newPassword }`，newPassword 沿用 8–256 校验
- currentPassword 校验失败 → 401 `UNAUTHORIZED`「当前密码错误」
- 成功后：事务外更新 passwordHash；然后删除该用户**除当前 sid 外**的所有 sessions（当前请求的 sid 来自 `req.cookies.sid`；若请求来自 Bearer PAT，则删除全部 sessions）
- **不吊销 PAT**（Q1 决策）

**DELETE /api/account**
- `{ password }` 验证失败 → 401
- 成功后 `delete(users)`，FK `ON DELETE CASCADE` 清除 sessions/entries/categories/tags/api_tokens/entry_tags
- `clearSessionCookie(reply, deps)`；返回 `{ ok: true }`
- 注：`entry_tags` 通过 entry 的 cascade 间接清除

**注册控制**
- `register` 路由开头检查 `!deps.registrationOpen` → 403 `FORBIDDEN`「注册已关闭」

### 响应体 `AuthUser` 扩展

`AuthUser` / `me` 响应增加 `displayName: string | null`。`loadUser` 两处返回点（Bearer/cookie）都需要带出该列。

## 3. 前端

### 新文件 `web/src/pages/SettingsPage.tsx`

页面结构（复用 ui 组件，风格对齐 TokensPage）：

1. **资料区**：username + displayName 输入，保存按钮 → PATCH /api/profile
2. **修改密码区**：currentPassword/newPassword/确认 newPassword 输入（前端校验两次一致）→ PATCH /api/account/password
3. **危险区**：注销账户 —— 输入密码确认的 dialog（复用 TokensPage 的 modal 模式）→ DELETE /api/account，成功后清除本地状态回到 AuthPage

### Shell 改动

- `PageId` 增加 `"settings"`，侧边栏 footer 的 username 按钮改为点击进入设置页（原来是纯展示 `pointer-events-none`）
- Footer 用户条目显示 displayName ?? username

### App.tsx / api.ts

- `User` 类型加 `displayName: string | null`；`me` 返回类型随之更新
- api client 新增：`updateProfile`、`changePassword`、`deleteAccount`
- 注册关闭：`GET /api/auth/me` 不受影响；AuthPage 需要「注册是否开放」信号 → 复用 `GET /api/auth/me` 401 响应不可行，新增轻量公开端点 `GET /api/meta`（或 `/api/auth/config`）返回 `{ registrationOpen: boolean }`，AuthPage 据此禁用注册 tab 并提示

### i18n

`web/src/i18n/locales/{zh,en}.ts` 新增 `settings.*`、`auth.registrationClosed` 等 key，zh/en 同步。

## 4. 权衡与备选

- **迁移方式**：备选是引入正式迁移工具（drizzle-kit）；当前库无此依赖、且仅加一列，内联幂等 ALTER 成本最低。若未来 schema 变更频繁再引入。
- **注册开关端点**：备选是把 registrationOpen 塞进某个 401 响应体；公开 meta 端点更直白，对未登录的 AuthPage 友好。
- **改密码会话语义**：Bearer 请求改密码时无 cookie，删全部 sessions 是唯一自洽行为（PAT 权限与浏览器会话本就同源）。

## 5. 兼容与回滚

- 旧库首启自动补列，`displayName` 全 NULL → UI fallback username，零破坏
- 新端点均为增量，不动现有路由签名
- 回滚 = revert commit；SQLite 不需要降级（多出的空列无害）

## 6. 测试计划

- `server/test/account.test.ts`（新）：profile 更新/409/400、改密码（错误旧密码 401、其他会话被吊销、当前会话保留、PAT 仍可用）、注销（数据级联、cookie 清除）、注册关闭 403
- `server/test/auth.test.ts`：me 返回 displayName
- 前端无测试框架（现状无 web test），以 typecheck + 手动验收为准