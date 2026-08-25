# Directory Structure

Backend is npm workspace `server/` (Fastify + TypeScript ESM). There is no `src/services/` or `src/utils/` layer — keep the current flat `src/` plus `routes/`.

## Layout

```
server/
├── src/
│   ├── index.ts          # listen; reads env (PORT, DATABASE_PATH, COOKIE_SECURE, SESSION_TTL_SECONDS, WEB_DIST)
│   ├── app.ts            # buildApp(AppConfig) — composition root
│   ├── schema.ts         # drizzle table defs + DEFAULT_CATEGORIES
│   ├── db.ts             # openDb, pragmas, SCHEMA_SQL, Deps
│   ├── errors.ts         # AppError, parseBody, isUniqueViolation
│   ├── auth.ts           # hash, cookies, sessions, requireUser / loadUser
│   ├── time.ts           # requireTz, todayBounds, clipSeconds, durationSeconds
│   ├── entries.ts        # running/today/stats queries and DTOs
│   └── routes/
│       ├── auth.ts
│       ├── categories.ts
│       ├── timer.ts
│       └── today.ts
├── test/
│   ├── helpers.ts        # createTestApp, cookieHeader, registerUser
│   └── *.test.ts
└── package.json
```

## Where new code goes

| Kind | Put it |
|------|--------|
| New HTTP surface | `server/src/routes/*.ts`, register from `app.ts` |
| Timer uniqueness, overlap, today list/stats | `server/src/entries.ts` (keep out of route files) |
| Calendar-day / duration math | `server/src/time.ts` |
| Session / password / cookie | `server/src/auth.ts` |
| Table shape | `schema.ts` **and** the `SCHEMA_SQL` string in `db.ts` |
| Boot wiring, error handler, static files | `app.ts` |
| Env defaults | `index.ts` only |

## Naming

- Route files: plural resource (`categories.ts`, not `categoryRoute.ts`).
- TypeScript fields: camelCase (`startedAt`, `passwordHash`).
- SQLite columns: snake_case (`started_at`, `password_hash`).
- Server ESM imports keep the `.js` suffix even though the source is `.ts`:

```ts
import { buildApp } from "./app.js";
import { AppError } from "../errors.js";
```

Frontend Vite imports do **not** use `.js` suffixes. Do not mix the two styles.

## Anti-patterns

- Do not add Hono, Express, Prisma, or a `shared/` package. Design locked Fastify + drizzle + two workspaces.
- Do not put SQL or overlap queries inside route handlers when `entries.ts` already owns that query.
- Do not create `src/utils.ts` for a one-off helper; put it next to the owner (`time.ts`, `errors.ts`, `auth.ts`).
