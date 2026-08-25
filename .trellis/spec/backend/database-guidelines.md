# Database Guidelines

SQLite file via `drizzle-orm` + `better-sqlite3`. Path comes from `DATABASE_PATH` (Docker: `/data/chronolog.db`; local default: `server/data/chronolog.db`).

## Connection pragmas

Set on every open in `openDb` (`server/src/db.ts`):

```
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
```

The volume must be local disk, not NFS. WAL needs `-wal` / `-shm` writable beside the db file. `openDb` creates the parent directory.

## Schema source of truth

This MVP does **not** use drizzle-kit migrations. Boot runs `CREATE TABLE IF NOT EXISTS` from `SCHEMA_SQL` in `server/src/db.ts`. `server/src/schema.ts` is the drizzle mirror used by queries.

When adding a column or index, update **both** files in the same change. Do not ship a destructive in-place `ALTER` that drops or retypes columns.

| Table | Notes |
|-------|--------|
| `users` | `username` unique with `COLLATE NOCASE`; `password_hash` Argon2id PHC |
| `sessions` | opaque id; `ON DELETE CASCADE` with user |
| `categories` | unique `(user_id, name)` |
| `time_entries` | `stopped_at` NULL = running; unique `(user_id) WHERE stopped_at IS NULL` |

Default categories on register: `DEFAULT_CATEGORIES` in `schema.ts` — `工作`, `学习`, `休息`, `事务`. Seeded in the same transaction as the user insert (`server/src/routes/auth.ts`).

All timestamps are UTC ISO-8601 text with `Z` from `Date.toISOString()`. Never store local wall time.

Entity ids: `randomUUID()` via `newId()` in `auth.ts`. Session ids: 32 random bytes, base64url (`newSessionId`).

## Running-timer uniqueness

### Scope

R3: one running timer per user. Enforced by the partial unique index **and** a stop-then-start transaction.

### Signatures

- Index: `time_entries_one_running` on `user_id` where `stopped_at is null` (`schema.ts` / `SCHEMA_SQL`).
- Start: `startOnce` in `server/src/routes/timer.ts` — look up owned category, stop existing running row, insert new row, same `db.transaction`.
- Race: catch `SQLITE_CONSTRAINT_UNIQUE` with `isUniqueViolation` and retry `startOnce` once.

### Contracts

- `stopped_at` null means running.
- `started_at` is generated server-side from `deps.now()`. Clients never send it.
- Category missing or not owned → 404 `NOT_FOUND` (inside the transaction).

### Tests

`server/test/timer.test.ts`: stop-then-start leaves exactly one `stopped_at IS NULL`. Reopening the same db file keeps the running row.

### Wrong vs correct

Wrong: insert a second running row and trust the UI. Wrong: stop the old timer in a separate request before start.

Correct: one transaction + partial unique index + one unique-violation retry.

## Category occupancy

`DELETE /api/categories/:id` counts `time_entries` for that category (running or stopped). Count > 0 → 409 `CONFLICT`. `time_entries.category_id` has no `ON DELETE CASCADE`; occupancy is an application rule (`server/src/routes/categories.ts`, `server/test/categories.test.ts`).
