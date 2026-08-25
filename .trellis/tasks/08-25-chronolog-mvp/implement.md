# Implement: Chronolog MVP

按顺序做。每步应能单独跑测试或手动点一遍。不要提前装 `@earendil-works/pi-*`。后端是 Fastify，不是 Hono。

## Checklist

1. **脚手架**
   - 根目录 npm workspaces：`server/`、`web/`。
   - `server`：Fastify、TypeScript、tsx 开发。
   - `web`：Vite React TS；dev 代理 `/api` → Fastify。
   - 根 `Dockerfile`（多阶段）+ `docker-compose.yml`（`app` + `/data` volume + `8080`）。
   - README：`docker compose up --build`、开发命令、`COOKIE_SECURE`。

2. **数据库**
   - Drizzle schema：`users`、`sessions`、`categories`、`time_entries`。
   - WAL、`busy_timeout=5000`、`foreign_keys=ON`。
   - 部分唯一索引：每用户最多一条 `stopped_at IS NULL`。
   - 启动时 migrate；空库可从零创建。

3. **鉴权**
   - register / login / logout / me。
   - Argon2id；cookie `sid`；规则见 `research/auth-self-hosted.md`。
   - 注册成功写入默认分类。
   - 测试：重复用户名、短密码、登出后 401、刷新仍登录。

4. **分类**
   - list / create / rename / delete。
   - 名称按用户唯一、非空。
   - 有条目占用则删除 409。
   - 测试：用户 A 看不到用户 B 的分类。

5. **计时器**
   - current / start / stop。
   - start 在事务里 stop-then-start。
   - `started_at` 只由服务端生成。
   - 测试：双开不会两条 running；关进程再开仍在跑。

6. **今日列表与合计**
   - `tz` 必填且校验 IANA。
   - 重叠查询 + 裁剪，见 `research/today-timezone.md`。
   - 测试：上海时区午夜前后；跨日 running 只把今天那段计入合计。

7. **前端**
   - 中文：登录/注册；登录后深色左栏切「计时 / 统计 / 分类」。
   - 计时页：Toggl 顶栏 + 今日列表，**不含**分类合计。见 `research/toggl-web-ui.md`。
   - 统计页：今日分类合计（R15）。
   - 分类页：增改删。
   - 未选分类不能开始。
   - 生产由 Fastify 托管 `web/dist`。

8. **验收收口**
   - `docker compose up --build` 走一遍 AC5/AC6（重启容器数据还在）。
   - 对照 `prd.md` AC1–AC15。

## Validation

开发：

```bash
npm install
npm run typecheck    # 两个 workspace
npm test             # server 单测至少覆盖：隔离、stop-then-start、今日裁剪、分类占用不可删
```

交付：

```bash
docker compose up --build -d
curl -sf http://localhost:8080/ | head
# 注册 → 开始 → 停止 → compose restart → 仍能登录且记录在
docker compose down
```

## Risky points

- `better-sqlite3` 原生模块：Docker 构建平台必须和运行一致。
- Volume 权限：SQLite 要能写 `-wal`/`-shm`。
- `COOKIE_SECURE=true` 在纯 HTTP 会导致登不上。
- 唯一索引与 stop-then-start 的竞态：必须在同一事务里处理。
- 不要用容器 UTC 日期当「今天」。

## Rollback

绿场。合入前保持可 `docker compose down` 并删 volume。不要做不可逆数据迁移。

## Before `task.py start`

- [x] `prd.md` 需求与验收已收敛
- [x] `design.md` 已写
- [x] 本文件已写
- [ ] 用户批准本规划摘要
- [x] `implement.jsonl` / `check.jsonl` 已填真实条目（见 1.3）
