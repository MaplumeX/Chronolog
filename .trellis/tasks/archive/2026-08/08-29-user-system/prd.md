# 完善用户系统

## Goal

为单用户自部署的 Chronolog 补齐用户系统常用能力，覆盖个人资料、密码、会话、账户生命周期管理。

## Confirmed Facts（代码库证据）

- 用户表 `users`：`id, username, password_hash, created_at`，username 唯一（NOCASE），无昵称/邮箱/头像字段。
- 认证：cookie session（`sid`）+ PAT Bearer（CLI/agent）。`loadUser` 双通道。
- 已有路由：register / login / logout / me；PAT 管理（tokens）。
- 无迁移系统：`db.ts` 用 `CREATE TABLE IF NOT EXISTS` 内联 schema，无 ALTER 机制 → 加列需要新增轻量迁移逻辑。
- Web 端：AuthPage（登录/注册）、TokensPage（PAT 管理已有）、Shell 侧边栏展示 username + 登出按钮。无设置页面。
- 单用户自部署场景，无邮箱基础设施（无邮件服务依赖）。

## Scope（1-大部分能力，2-单用户场景）

### In Scope（本轮实现）

1. **个人资料管理**
   - 修改用户名（保留唯一性校验，复用注册时的 3–32 位规则）
   - 修改显示昵称（`display_name` 可空字段，用于 UI 展示，fallback 到 username）
   - `GET /api/auth/me` 返回 displayName
2. **密码管理**
   - 修改密码（需旧密码验证；成功后吊销其他会话，保留当前会话；不吊销 PAT）
   - 密码规则沿用注册（8–256）
3. **注销账户（危险操作）**
   - `DELETE /api/account`：需密码确认；级联删除所有数据（FK cascade 已覆盖 entries/categories/tags/sessions/tokens）；返回后清除 cookie
4. **注册控制（单用户场景）**
   - 环境变量 `REGISTRATION_OPEN`（默认 open）；关闭后 register 返回 403
5. **Web 设置页**（`/settings`）
   - 整合：资料编辑、改密码、注销账户；入口放侧边栏 footer

### Out of Scope（本轮不做）

- 会话列表管理（列出/单独吊销会话）：单用户场景价值低，不做；改密码时自动吊销其他会话已覆盖「疑遭入侵」场景
- 邮箱（无邮件基础设施）：忘记密码、邮箱验证、通知 → 单用户场景改密码走登录态即可
- 头像上传（文件存储成本高，可后续加）
- 邀请码注册
- 多用户/权限/团队功能

## Acceptance Criteria

- [ ] 可修改用户名（重复用户名 409）与昵称；`me` 返回 displayName，UI 优先展示 displayName
- [ ] 修改密码需验证旧密码；错误旧密码 401/400；成功后其他会话失效、当前会话保留，PAT 不受影响
- [ ] 注销账户需密码确认，删除后所有端点对已删用户 401，数据级联清除
- [ ] `REGISTRATION_OPEN=false` 时注册接口返回 403，UI 注册 tab 提示不可用
- [ ] 所有新端点要求登录（cookie 或 Bearer 均可），跨用户资源 404
- [ ] server 测试覆盖以上场景；typecheck/test 通过
- [ ] i18n：zh/en 双语文案齐全

## Resolved Decisions

- Q1: 修改密码后**不吊销 PAT**（PAT 与密码为独立凭证；紧急情况可在 tokens 页手动 revoke）。
- Q2: **不做会话列表管理**（含设备/来源信息）；单用户场景价值低，改密码时自动吊销其他会话已覆盖主要需求。