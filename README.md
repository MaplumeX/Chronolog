# Chronolog

自托管的多用户时间追踪器：Toggl 式开始/停止，每条记录必须属于一个分类，在统计页查看今天各类花了多久。

## 用 Docker 启动

### 方式一：从源码构建

```bash
docker compose up --build
```

### 方式二：拉取官方镜像（推荐，无需本地构建）

```yaml
# docker-compose.yml 中去掉 build: .，镜像名默认已是
# ghcr.io/maplumex/chronolog:latest
services:
  app:
    image: ghcr.io/maplumex/chronolog:latest
    # ...
```

```bash
docker compose up -d
```

升级到新版本时：

```bash
docker compose pull && docker compose up -d
```

镜像托管在 GitHub Container Registry，每个版本 tag（`v1.2.3`）都有对应镜像，`latest` 跟随最新正式版。支持 `linux/amd64` 和 `linux/arm64`。

浏览器打开 http://localhost:8080 。数据保存在 named volume `chronolog-data`（容器内 `/data/chronolog.db`），重启容器不会丢账号、分类、记录和正在跑的计时器。

若前面有 HTTPS 反代，把 `COOKIE_SECURE` 设为 `true`，否则浏览器在纯 HTTP 下会丢掉登录 cookie：

```yaml
environment:
  COOKIE_SECURE: "true"
```

默认 `COOKIE_SECURE=false`，适合本机或局域网 HTTP。

容器内置健康检查（`/api/health`）并以非 root 用户运行；`REGISTRATION_OPEN=false` 可关闭公开注册（建议建好账号后关闭）。

## 发版流程

仓库使用 conventional commits（`feat:` / `fix:` / `chore:` …），版本通过 Git tag 管理：

1. 平时正常合并到 `main`（CI 会跑 typecheck + 测试）。
2. 发版时打 tag 并推送：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions 自动：
   - 构建多架构镜像（amd64/arm64）并推送到 `ghcr.io/maplumex/chronolog`，打上 `v1.0.0`/`1.0`/`latest` 对应的 tag；
   - 根据 conventional commits 生成 changelog，创建 GitHub Release 发布页。

在仓库的 **Actions** 页可查看进度，**Releases** 页可看到每个版本的变更日志。

## 本地开发

需要 Node.js 22+。

```bash
npm install
npm run dev
```

- API：http://127.0.0.1:8080
- 前端（Vite，`/api` 代理到 API）：http://127.0.0.1:5173

其它命令：

```bash
npm run typecheck
npm test
npm run build          # 构建 web/dist
WEB_DIST=../web/dist npm start -w server
```

## 账号

公开注册，用户名 + 密码。用户名 3–32 个字母/数字/下划线，密码至少 8 位。新用户预置分类：工作、学习、休息、事务。
