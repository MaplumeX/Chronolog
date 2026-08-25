# Database Guidelines

SQLite file via `drizzle-orm` + `better-sqlite3`. Path: `DATABASE_PATH` (Docker: `/data/chronolog.db`).

## Connection pragmas

Set on open (`server/src/db.ts`):

```
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
```

Volume must be local (not NFS). WAL needs `-wal`/`-shm` writable beside the db file.

## Schema

| Table | Notes |
|---|---|
| `users` | `username` unique; `password_hash` Argon2id PHC |
| `sessions` | opaque id; cascade delete with user |
| `categories` | unique `(user_id, name)` |
| `time_entries` | `stopped_at` NULL = running; unique `(user_id) WHERE stopped_at IS NULL` |

All timestamps are UTC ISO-8601 text with `Z`. Never store local wall time.

This MVP uses `CREATE TABLE IF NOT EXISTS` on boot, not drizzle-kit migrations. Do not add destructive ALTERs in-place.

## Scenario: time_entries running uniqueness

### 1. Scope / Trigger
Start timer and “one running per user” (R3). Cross-layer: DB unique index + API transaction.

### 2. Signatures
- `time_entries_one_running` unique on `user_id` where `stopped_at is null`
- Start: stop existing running row then insert, same transaction (`server/src/entries.ts`)

### 3. Contracts
- `stopped_at` null means running
- `started_at` generated server-side only

### 4. Validation & Error Matrix
- Category missing / not owned → 404 `NOT_FOUND`
- Stop with no running → 409
- Unique race → retry stop-then-start once

### 5. Good/Base/Bad Cases
- Good: start while running → old row gets `stopped_at`, one new running
- Base: start with no running → one insert
- Bad: two running rows for one user

### 6. Tests Required
- `server/test/`: stop-then-start leaves exactly one `stopped_at IS NULL`

### 7. Wrong vs Correct
#### Wrong
Insert a second running row; rely on UI only.
#### Correct
Transaction + partial unique index.
