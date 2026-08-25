# Research: stack

- Query: Recommend a concrete stack for a greenfield Docker self-hosted web app (one compose file, frontend + API, persistent data). Compare SQLite vs Postgres; TypeScript fullstack vs Python FastAPI + React.
- Scope: mixed
- Date: 2026-08-25

## Decision (user-locked 2026-08-26)

后端框架改为 **Fastify**，不用 Hono。其余仍有效：Node 22、Vite React、SQLite、Argon2id、cookie session、单容器。

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS |
| API | Fastify + `@fastify/cookie` + `@fastify/static` |
| Frontend | Vite + React + TypeScript SPA |
| DB | SQLite via `drizzle-orm` + `better-sqlite3` |
| Hash | Argon2id via `@node-rs/argon2` |
| Session | Opaque cookie + `sessions` table (see `auth-self-hosted.md`) |
| Validation | `zod`（或 Fastify JSON Schema；不要两套） |
| Docker | Single `app` service + named volume `/data` |

原因：用户不熟 Hono；Fastify 更常见，仍是 Node/TS，日后可同进程 `import` pi。Hono 的多运行时优势对本 Docker 应用无用。

下文「Recommendation」里的 Hono 是调研原稿，**实现时以本 Decision 为准**。

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/08-25-chronolog-mvp/prd.md` | Locked MVP: Docker web app, multi-user, categories, start/stop timer, persist across restart (R6–R7) |
| `.trellis/spec/backend/database-guidelines.md` | Empty scaffold; no ORM yet |
| `.trellis/spec/frontend/index.md` | Empty scaffold; no UI framework yet |
| Repo root | Greenfield: no `src/`, no compose file |

### Comparison: database

| | SQLite + volume | Postgres service |
|---|---|---|
| Compose | 1 service | app + postgres + healthcheck + credentials |
| Persist (R7) | Mount `/data` | Extra volume + `POSTGRES_*` env |
| Backup | Copy one `.db` (plus `-wal`/`-shm` after checkpoint) | `pg_dump` |
| Concurrency | WAL: many readers, one writer | Real multi-writer |
| Fit | Self-hosted instance, tens of users, timer/auth writes | Overkill for MVP |

SQLite is the default for other self-hosted tools at this scale (n8n SQLite edition, PocketBase). WAL + `busy_timeout` is enough for auth, categories, one running timer per user, and today totals.

**Reject Postgres for MVP.** Add it later only if a second replica or heavy concurrent writers appear.

SQLite production pragmas (set on connect):

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
```

Sources: [better-sqlite3 WAL](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md), [SQLite WAL](https://www.sqlite.org/wal.html).

Caveat: keep the DB on a **local Docker named volume**, not NFS/CIFS. WAL needs POSIX locks on one host.

### Comparison: language / framework

| | Vite React + Hono (TS) | FastAPI + React |
|---|---|---|
| Languages | One | Python + TypeScript |
| Types | Shared Zod / TS types | Duplicate models or extra codegen |
| Docker | One Node image | Python image + Node build stage, or two services |
| Auth cookies | `hono/cookie`, same origin | Starlette SessionMiddleware + CORS if split |
| Password | `@node-rs/argon2` | `argon2-cffi` (fine) |
| SQLite | `better-sqlite3` (sync, fast) | `sqlite3` / SQLAlchemy / aiosqlite |

FastAPI is excellent, but it splits the repo into two ecosystems for an SPA that is mostly CRUD + a ticking timer. Hono is a small router with `serveStatic`, so the container is one Node process.

**Reject Fastify** only as a preference: it is more plugin-heavy; Hono is smaller and has first-class cookies/static serving. Either Node framework would work.

**Reject Next.js / SSR:** timer page does not need SSR; extra Docker and auth surface.

### Compose shape (MVP)

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_PATH: /data/chronolog.db
      COOKIE_SECURE: "false"   # "true" behind HTTPS reverse proxy
      SESSION_TTL_SECONDS: "604800"
    volumes:
      - chronolog-data:/data
    restart: unless-stopped

volumes:
  chronolog-data:
```

Multi-stage Dockerfile: `npm run build` the SPA, copy `dist/` + API into a Node runtime image, `CMD` starts Hono. Volume must be writable so SQLite can create `chronolog.db-wal` and `chronolog.db-shm`.

Dev: Vite on `:5173` proxies `/api` to Hono; cookies use `SameSite=Lax` on localhost.

### Libraries (concrete)

| Need | Package | Why |
|---|---|---|
| Password hashing | `@node-rs/argon2` | Argon2id, napi-rs prebuilds (no `node-gyp`). OWASP first choice. Params: m=19456, t=2, p=1. |
| Session cookie | `hono/cookie` + own `sessions` table | Opaque ID in HttpOnly cookie; revoke on logout (R11 / AC10). |
| SQLite driver | `better-sqlite3` | Sync, WAL-friendly, faster than `node:sqlite` async wrappers for this app. |
| ORM / migrations | `drizzle-orm` + `drizzle-kit` | Schema in TypeScript; `drizzle-kit migrate` on boot. |
| HTTP | `hono` + `@hono/node-server` | Routes, `serveStatic`, cookie helpers. |
| SPA | `vite`, `react`, `react-dom` | Timer UI + category CRUD. |
| Client timer display | `setInterval` + server `started_at` | Elapsed = now − UTC start; do not store elapsed. |

Do **not** use Better Auth / Lucia for MVP: they pull email/OAuth tables we do not have (open username+password, no verification). A 40-line session helper is enough.

### How this covers MVP features

- **Auth:** `users` + `sessions` in the same SQLite file; Argon2id verify on login.
- **Categories:** per-user rows; unique name per user; FK from entries; delete blocked if any entry (running or stopped) references it (R14).
- **Timer:** `time_entries.stopped_at IS NULL` means running; partial unique index on `user_id` enforces R3.
- **Today totals:** SQL overlap against `[localDayStart, localDayEnd)` computed from the request timezone (see `today-timezone.md`).

## Caveats / Not Found

- Native `node:crypto` Argon2 exists only on recent Node (24.7+). Pin `@node-rs/argon2` until the image is on that line.
- `better-sqlite3` is a native addon; Docker image must match the build platform (or use a build stage with the same libc).
- Specs under `.trellis/spec/` are empty; this recommendation is unconstrained by existing code.
- PRD open question on “今日分类合计” is assumed in-scope for this stack note because the dispatch listed it; if planning drops it, the stack does not change.

### External References

- [Hono docs](https://hono.dev/docs/)
- [Drizzle SQLite + better-sqlite3](https://orm.drizzle.team/docs/get-started-sqlite)
- [OWASP Password Storage (Argon2id)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [better-sqlite3 WAL](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md)
- [SQLite vs Postgres for self-hosted / solo](https://www.kunalganglani.com/blog/sqlite-vs-postgresql-for-apps)
