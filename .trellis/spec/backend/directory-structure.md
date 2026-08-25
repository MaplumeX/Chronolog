# Directory Structure

Chronolog backend lives in `server/` (Fastify + TypeScript ESM).

## Layout

```
server/
├── src/
│   ├── index.ts          # listen; reads env
│   ├── app.ts            # buildApp({ dbPath, cookieSecure, sessionTtlSeconds, webDist })
│   ├── schema.ts         # drizzle tables + DEFAULT_CATEGORIES
│   ├── db.ts             # sqlite open, pragmas, CREATE TABLE
│   ├── errors.ts         # AppError, parseBody (zod)
│   ├── auth.ts           # hash, sessions, requireUser
│   ├── time.ts           # IANA tz, todayBounds, clipSeconds
│   ├── entries.ts        # overlap query, stop-then-start
│   └── routes/
│       ├── auth.ts
│       ├── categories.ts
│       ├── timer.ts
│       └── today.ts
└── test/
```

New HTTP surface goes in `routes/`. Shared domain (timer uniqueness, day clip) stays out of route files.

## Naming

- Route files: plural resource (`categories.ts`)
- Instants: `startedAt` / `stoppedAt` in TS; `started_at` / `stopped_at` in SQLite
- ESM imports use `.js` suffix (`./app.js`)
