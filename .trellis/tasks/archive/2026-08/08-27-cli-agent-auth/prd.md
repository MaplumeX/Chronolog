# CLI/Agent token 认证（PAT + Bearer）

## Goal

为非浏览器客户端（未来的 CLI / agent）提供基于 Personal Access Token 的认证方式，使其无需浏览器 cookie、无需暴露用户密码即可访问 API，并在 Web 界面提供 token 管理入口。现有 Web 端的 cookie session 认证行为保持完全不变。

## Background（已确认的代码事实）

- 当前认证为服务端 Session + HttpOnly Cookie：
  - 登录/注册在 `server/src/routes/auth.ts`，Argon2 哈希密码，`replaceSession()` 防会话固定
  - `server/src/auth.ts` 中 `loadUser()` 从 `req.cookies.sid` 查 `sessions` 表并校验过期，`requireUser()` 抛 401
  - 前端 `web/src/api.ts` 使用 `credentials: "same-origin"`
- 数据库为 SQLite + Drizzle（`server/src/schema.ts`），建表使用 `db.ts` 中的 `SCHEMA_SQL`（`CREATE TABLE IF NOT EXISTS`，启动时 `sqlite.exec`，无迁移框架）
- 测试模式：`server/test/helpers.ts` 的 `createTestApp` + Fastify `inject`，参考 `server/test/auth.test.ts`
- 前端无路由库，页面按 `PageId` 切换（`web/src/App.tsx` + `web/src/components/Shell.tsx` 的 NAV 项），管理页参考 `web/src/pages/TagsPage.tsx`（Table + 确认删除模式）；文案在 `web/src/i18n/locales/{zh,en}.ts`

## Requirements

- R1: API 支持 `Authorization: Bearer <token>` 认证；无 Bearer 头时回落到现有 cookie 逻辑，Web 端零影响
- R2: 新增 token 数据表与管理 API：
  - `POST /api/tokens`（body: `{ name }`）创建，响应含明文 token，明文仅此一次返回
  - `GET /api/tokens` 列表（id、name、createdAt、lastUsedAt，不含哈希/明文）
  - `DELETE /api/tokens/:id` 撤销，立即失效
- R3: 数据库只存 token 的 SHA-256 哈希（token 熵高，无需 argon2）
- R4: token 支持命名；每次 Bearer 认证成功时更新 `lastUsedAt`
- R5: Web 端新增 "API Tokens" 设置页：创建（弹窗/内联展示明文一次 + 复制按钮）、列表、撤销（确认后删除）

## Acceptance Criteria

- [ ] 使用有效 Bearer token 的请求（如 `GET /api/auth/me`）能通过鉴权，返回对应用户数据
- [ ] 无效、已撤销的 token 返回 401
- [ ] 无 Bearer 头的请求行为与改动前完全一致（cookie session 继续工作）
- [ ] 创建 token 的响应包含明文 token，且数据库 `api_tokens` 表中不存在明文（仅哈希）
- [ ] 撤销后的 token 立即失效（后续请求 401）
- [ ] Web 设置页可创建、查看列表、撤销 token；明文只在创建后展示一次
- [ ] `npm test -w server` 与 `npm run typecheck` 通过（含新增 token 认证/管理测试）

## Out of Scope

- OAuth device flow、JWT 等更重的方案（单人自托管，过度设计）
- token 权限 scope（只读等）——已决策 D2：全权限、无 scope
- token 过期时间（长期有效，靠手动撤销管理）

## Decisions

- D1（2026-08-27，用户确认）：范围包含后端 + Web 端 token 管理界面，因为 CLI 尚不存在，Web 界面是当前唯一可用的 token 生成入口。
- D2（2026-08-27，用户确认）：token 全权限、无 scope。