# Design: Chronolog MVP

## Architecture

单进程 Docker 应用：Fastify 提供 `/api/*`，并托管 Vite 构建出的静态前端。同一源，cookie 不跨域。

```
浏览器 ──► Fastify :8080
              ├─ /api/*     JSON API（cookie 会话）
              ├─ /*         web/dist SPA
              └─ SQLite     /data/chronolog.db（named volume）
```

仓库布局（npm workspaces，两个包，不要再拆 shared）：

```
package.json              workspaces: ["server", "web"]
docker-compose.yml
Dockerfile
server/                   Fastify + Drizzle + SQLite
web/                      Vite + React + TypeScript
```

开发：Vite `:5173` 把 `/api` 代理到 Fastify，保持 cookie 同源。生产：一个 Node 进程。

## Stack (locked)

| 层 | 选择 | 不要用 |
|---|---|---|
| Node 22 LTS | 镜像与 `engines` 钉 22 | Node 20（挡 pi） |
| Fastify | `@fastify/cookie`、`@fastify/static` | Hono、Next.js、Express |
| React + Vite + TS | SPA，无 SSR | |
| drizzle-orm + better-sqlite3 | WAL 文件库 | Postgres（本版） |
| `@node-rs/argon2` | Argon2id | bcrypt、明文 |
| zod | 请求校验只此一套 | 再叠 Fastify JSON Schema |
| luxon | IANA 时区算「今天」 | 手写 `+8` 小时 |
| 不引入 | `@earendil-works/pi-*` | 本版不做 agent |

## Data

时间一律存 **UTC instant**（ISO-8601 文本，带 `Z`）。「今天」不存库，按请求的 IANA `tz` 现算。

```
users          id, username (NOCASE unique), password_hash, created_at
sessions       id (CSPRNG), user_id, expires_at, created_at
categories     id, user_id, name, created_at
               UNIQUE(user_id, name)
time_entries   id, user_id, category_id, description, started_at, stopped_at
               stopped_at NULL = 正在跑
               UNIQUE INDEX (user_id) WHERE stopped_at IS NULL
```

外键：`sessions.user_id`、`categories.user_id`、`time_entries.user_id`、`time_entries.category_id`。`PRAGMA foreign_keys = ON`。

注册事务：插 user → 插四个默认分类（工作、学习、休息、事务）→ 建 session。

删除分类：若存在任意 `time_entries`（含 `stopped_at IS NULL`）引用则 409。

开始计时（单事务）：若有 running 行则写入 `stopped_at = now`；再插入新 running 行。唯一索引防双开；冲突则按 stop-then-start 重试一次。

## Auth

不透明 session id，HttpOnly cookie `sid`。Logout 删 session 行并清 cookie。见 `research/auth-self-hosted.md`。

| Cookie | HTTP Docker | HTTPS 反代 |
|---|---|---|
| HttpOnly | true | true |
| SameSite | Lax | Lax |
| Secure | `COOKIE_SECURE=false` | `COOKIE_SECURE=true` |
| Path | `/` | `/` |
| Max-Age | 7 天 | 7 天 |

登录后换新 session id。密码 Argon2id m=19456, t=2, p=1。用户名规范化后大小写不敏感唯一。

公开：`POST /api/auth/register`、`POST /api/auth/login`。其余 `/api/*` 无有效 session → 401。

## HTTP contracts

错误体：`{ "error": { "code": "string", "message": "中文" } }`。校验失败 400；未登录 401；找不到或不属于当前用户 404（不泄露跨用户存在性）；分类占用 409。

`tz`：query，IANA 名（如 `Asia/Shanghai`）。非法 → 400。浏览器用 `Intl.DateTimeFormat().resolvedOptions().timeZone`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | `{ username, password }` → 用户 + Set-Cookie |
| POST | `/api/auth/login` | 同上 |
| POST | `/api/auth/logout` | 删 session |
| GET | `/api/auth/me` | `{ id, username }` |
| GET | `/api/categories` | 当前用户分类 |
| POST | `/api/categories` | `{ name }` |
| PATCH | `/api/categories/:id` | `{ name }` |
| DELETE | `/api/categories/:id` | 占用则 409 |
| GET | `/api/timer/current` | running 或 `null` |
| POST | `/api/timer/start` | `{ categoryId, description? }` 可先停旧的 |
| POST | `/api/timer/stop` | 无 running → 409 |
| GET | `/api/entries/today?tz=` | 与今天区间重叠的条目（含 running） |
| GET | `/api/stats/today?tz=` | 按分类合计，时长裁剪到今天 |

条目与合计的重叠/裁剪算法见 `research/today-timezone.md`。`started_at` 只在服务端 `Start` 时生成，客户端不传开始时间。

时长：API 返回 UTC instant；秒数可附带，但权威仍是 `stopped_at ?? now - started_at`（合计用裁剪后的）。

## Frontend

中文。未登录：注册 / 登录。已登录是 Toggl 式桌面壳（见 `research/toggl-web-ui.md`）：深色全高左栏 + 浅米色主区。

左栏三项（对 Toggl 的 TRACK / ANALYZE / MANAGE）：

| 左栏 | 主区 |
|---|---|
| 计时 | 白顶栏（说明 + 必选分类胶囊 + 等宽时间 + 圆钮开始/停止）+ 今日白列表（日标题、日合计、行：说明 / 分类 / 起止 / 时长）。**没有右侧合计栏，没有分类合计。** |
| 统计 | 今日各分类时长（条或表）。柳比歇夫复盘只在这里。本版没有周/月、没有图表仪表盘。 |
| 分类 | 分类表：名称、记录数、重命名、删除（占用则说明原因）。 |

计时页不要 Calendar / Timesheet / 周选择器。刷新后 `GET /api/auth/me` + `GET /api/timer/current` 恢复顶栏。elapsed 本地 `setInterval`，不存库，不用 `beforeunload` 停表。

左栏底：用户名、退出。计时中可在「计时」项旁显示当前 elapsed（Toggl 左栏也会显示）。

## Docker / ops

`docker compose up`：服务 `app`，端口 `8080:8080`，卷 `chronolog-data:/data`，`DATABASE_PATH=/data/chronolog.db`，`COOKIE_SECURE` 默认 false。

多阶段 Dockerfile：装依赖 → 构建 `web` → 复制 `server` + `web/dist` → `node` 启动 Fastify。volume 可写（WAL 要 `-wal`/`-shm`）。库文件不要放 NFS。

进程启动时跑 drizzle migrate。备份 = 停写或 checkpoint 后拷贝 `.db`。

回滚：单容器，关掉 compose 即停；数据在 volume 里。破坏性迁移本版不要做——schema 一次建齐。

## Trade-offs

- Fastify 而非 Hono：生态更熟，多写一点 Node 适配；不需要边缘部署。
- SQLite 而非 Postgres：单实例够用；以后要多副本再迁。
- 同进程静态 + API：部署简单；以后接 pi 也在这个 Node 进程 `import`，本版不装那些包。
- 「今天」跟浏览器时区：出差换区时「今天」会变；比用户设置时区少一块 UI。

## Compatibility

绿场，无迁移负担。Node 22 + ESM，给以后 pi（`>=22.19.0`）留口，本版不调用。
