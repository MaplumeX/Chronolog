# Chronolog spec bootstrap — repository analysis

Date: 2026-08-26

## Analysis assumptions

- Trellis is initialized. Spec layers today: `backend`, `frontend`, plus `guides`.
- `python3 ./.trellis/scripts/get_context.py --mode packages` reports a single-repo project (no Trellis `packages:` in `.trellis/config.yaml`). npm workspaces `server` and `web` map onto those two spec layers, not onto `spec/server/` or `spec/web/`.
- GitNexus and ABCoder MCP servers were not available in this host. Architecture was taken from manifests, source, tests, README, Docker files, and the archived MVP task `.trellis/tasks/archive/2026-08/08-25-chronolog-mvp/`.
- Existing `.trellis/spec/` files were already partially filled from that MVP session. This pass refreshes them from current source, removes template leftover, and adds the local patterns the template missed.

## Packages and layers

| Area | Path | Role |
|------|------|------|
| API + SQLite | `server/` | Fastify 5, drizzle-orm, better-sqlite3, zod, luxon, Argon2id |
| SPA | `web/` | Vite 8 + React 19, no router library, no CSS framework |
| Ops | `Dockerfile`, `docker-compose.yml` | One Node 22 process serves `/api` and `web/dist` |

Root scripts: `npm run dev` (concurrently), `typecheck`, `test` (server only), `build` (web), `start` (server).

## Core abstractions

- `buildApp` in `server/src/app.ts` is the composition root. Tests call it with a temp db and injectable `now`.
- `Deps` (`server/src/db.ts`) carries `db`, `sqlite`, cookie flags, session TTL, and `now`.
- `AppError` + `parseBody` (`server/src/errors.ts`) is the only HTTP error path agents should add.
- Session cookie `sid` (`server/src/auth.ts`). No JWT.
- Domain queries live in `server/src/entries.ts` and `server/src/time.ts`, not in route files.
- Frontend HTTP and DTO types live in `web/src/api.ts`. Session user + running entry live in `web/src/App.tsx`.

## Data flow

1. Browser cookie `sid` → `requireUser` / `loadUser`.
2. Timer start is a SQLite transaction: stop running row if any, insert new row, `started_at` from server `now()`.
3. “Today” is not stored. Client sends `?tz=` from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Server computes `[dayStart, dayEnd)` with luxon and clips overlapping entries.
4. JSON field names are camelCase. SQLite columns are snake_case.

## Spec files to create, keep, or reshape

Keep layer dirs `backend/` and `frontend/` (Trellis single-repo layout).

Add:

- `backend/auth.md`
- `backend/time-and-timezone.md`
- `backend/http-routes.md`
- `frontend/api-client.md`

Refresh every existing guideline. Strip “How to Fill These Guidelines” from indexes. Rewrite `guides/` so they describe Chronolog boundaries, not Trellis CLI/template internals.

## Known spec bugs found during analysis

- `.trellis/spec/backend/error-handling.md` listed 401 as `UNAUTHENTICATED`. Source and `server/test/auth.test.ts` use `UNAUTHORIZED`.
- Timer page may show a **day grand total**; it must not show **per-category totals**. The old frontend quality note was easy to over-read as “no totals at all”.
