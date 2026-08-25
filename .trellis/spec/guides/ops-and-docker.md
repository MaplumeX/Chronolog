# Ops and Docker

One Node 22 process. Fastify serves `/api/*` and, when `WEB_DIST` exists, the Vite SPA.

## Local

```bash
npm install          # Node 22+
npm run dev          # API :8080, Vite :5173 with /api proxy
npm run typecheck
npm test             # server
npm run build        # web/dist
WEB_DIST=../web/dist npm start -w server
```

## Docker

`docker compose up --build` → http://localhost:8080

| Env | Default | Meaning |
|-----|---------|---------|
| `PORT` | 8080 | listen |
| `DATABASE_PATH` | `/data/chronolog.db` | SQLite file |
| `WEB_DIST` | `/app/web/dist` | SPA root |
| `COOKIE_SECURE` | `false` | set `true` only behind HTTPS |
| `SESSION_TTL_SECONDS` | 604800 | cookie max-age |

Named volume `chronolog-data` → `/data`. WAL needs `-wal` / `-shm` on the same volume. Do not put the db on NFS.

Dockerfile is multi-stage: native modules (`better-sqlite3`, argon2) need `python3 make g++` at build; runtime copies `node_modules`, `server/`, and `web/dist`. CMD is `npm start -w server`.

## Cookie / reverse proxy

Plain HTTP (LAN, local): keep `COOKIE_SECURE=false` or browsers drop `sid` (README). HTTPS reverse proxy: `COOKIE_SECURE=true`. SameSite is Lax; no CORS setup — do not split API and SPA across origins in this MVP.

## Data

Schema is created with `CREATE TABLE IF NOT EXISTS` on boot. No drizzle-kit in production. Backup = copy `chronolog.db` (checkpoint/stop writes first). Do not add destructive ALTERs.

## Anti-patterns

- Serving the SPA from Vite in production instead of `WEB_DIST`
- Binding only `127.0.0.1` inside the container (`index.ts` already uses `0.0.0.0`)
- Adding Postgres “for Docker” — the volume is the durability story
