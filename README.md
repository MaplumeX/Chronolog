# Chronolog

自托管的多用户时间追踪器：Toggl 式开始/停止，每条记录必须属于一个分类，在统计页查看今天各类花了多久。

## 用 Docker 启动

```bash
docker compose up --build
```

浏览器打开 http://localhost:8080 。数据保存在 named volume `chronolog-data`（容器内 `/data/chronolog.db`），重启容器不会丢账号、分类、记录和正在跑的计时器。

若前面有 HTTPS 反代，把 `COOKIE_SECURE` 设为 `true`，否则浏览器在纯 HTTP 下会丢掉登录 cookie：

```yaml
environment:
  COOKIE_SECURE: "true"
```

默认 `COOKIE_SECURE=false`，适合本机或局域网 HTTP。

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
