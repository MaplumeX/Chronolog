# Design: CLI/Agent token 认证（PAT + Bearer）

## 架构与边界

改动集中在三个层次，全部复用现有模式：

1. **数据层**（`server/src/schema.ts` + `server/src/db.ts`）：新增 `api_tokens` 表
2. **认证层**（`server/src/auth.ts`）：`loadUser()` 增加 Bearer token 分支
3. **API 层**（新增 `server/src/routes/tokens.ts`）：token 管理 CRUD
4. **前端**（`web/src`）：新增 TokensPage + Shell 导航项 + api 方法 + i18n 文案

## 数据模型

```ts
// schema.ts
export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),            // uuid (newId())
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),           // 用户备注，如 "my-cli"
    tokenHash: text("token_hash").notNull(),// SHA-256 hex
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),       // null = 从未使用
  },
  (t) => [
    uniqueIndex("api_tokens_token_hash").on(t.tokenHash),
    index("api_tokens_user_id").on(t.userId),
  ],
);
```

`db.ts` 的 `SCHEMA_SQL` 同步追加对应 `CREATE TABLE IF NOT EXISTS` + 索引（项目无迁移框架，启动时 `sqlite.exec` 幂等建表，与现有表一致）。

## Token 格式与哈希

- 明文格式：`ctt_<32字节 base64url>`（`ctt` = ChronoLog Token，前缀便于识别/扫描泄露）
- 生成：`randomBytes(32)`，与 `newSessionId()` 同源熵
- 哈希：`createHash("sha256").update(token).digest("hex")`，查询用 `eq(apiTokens.tokenHash, hash)`，走唯一索引

## 认证流程（loadUser 修改）

```
loadUser(req, deps):
  1. Authorization: Bearer <token> 存在？
     → sha256(token) 查 api_tokens
     → 命中：查 users 返回 AuthUser；旁路更新 last_used_at（仅当与当天不同，避免每写写一行——简化：直接每次更新，单人 SQLite 写放大可忽略）
     → 未命中：return null（最终 401）
  2. 否则走现有 cookie sid 逻辑（完全不变）
```

- Bearer 分支不删除过期 token（PAT 无过期概念）
- `requireUser()` 无需改动，自动获得两种认证方式
- token 撤销 = 删除行，立即生效（每次请求实时查库，与 session 同模式）

## API 契约

| Method | Path | 请求 | 响应 | 说明 |
|---|---|---|---|---|
| POST | `/api/tokens` | `{ name: string }`（1–64 字符） | `{ id, name, token, createdAt }` | token 明文仅此一次 |
| GET | `/api/tokens` | — | `{ tokens: [{ id, name, createdAt, lastUsedAt }] }` | 不含哈希 |
| DELETE | `/api/tokens/:id` | — | `{ ok: true }` | 撤销；不存在的 id 返回 404 |

- 全部走 `requireUser()`（cookie 或 Bearer 均可管理 token，与 Toggl 行为一致；单人服务无提权风险）
- name 校验：`z.string().min(1).max(64)`
- 错误格式复用 `AppError`（`errors.ts`）

## 前端设计

- **导航**：`Shell.tsx` NAV 数组加 `{ id: "tokens", labelKey: "nav.tokens", icon: KeyRound }`；`App.tsx` 增加 `page === "tokens"` 分支与 header title
- **TokensPage**（参考 `TagsPage.tsx` 模式）：
  - Table 列：name、createdAt、lastUsedAt、操作（撤销，确认式删除）
  - 创建：内联表单（name 输入 + 创建按钮）
  - 创建成功：弹层展示明文 token + 复制按钮 + "仅显示一次"警告；关闭后不再可见
- **api.ts**：`createToken / tokens / deleteToken` 三个方法
- **i18n**：`zh.ts` / `en.ts` 增加 `nav.tokens` 与 tokens 页相关文案

## 兼容与回滚

- Web 端零影响：不带 Bearer 头走原 cookie 路径；`SCHEMA_SQL` 幂等，老库启动时自动补表
- 回滚：revert 即可，`api_tokens` 表残留无害（不被读取）
- 风险点：`loadUser` 是所有路由的热路径——Bearer 分支只在有 Authorization 头时才查库，cookie 请求零额外开销