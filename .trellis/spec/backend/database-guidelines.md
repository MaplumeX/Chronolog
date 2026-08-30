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

When adding a column or index, update **both** files in the same change. For new columns on existing tables, also add an idempotent migration in `migrate()` (`openDb`): `PRAGMA table_info(<table>)` to check, then `ALTER TABLE ... ADD COLUMN` (SQLite has no `ADD COLUMN IF NOT EXISTS`). Do not ship a destructive in-place `ALTER` that drops or retypes columns.

| Table | Notes |
|-------|--------|
| `users` | `username` unique with `COLLATE NOCASE`; `password_hash` Argon2id PHC; `display_name` nullable (added task 08-29-user-system) |
| `sessions` | opaque id; `ON DELETE CASCADE` with user |
| `categories` | `parent_id` TEXT nullable (two-level hierarchy, task 08-30-hierarchical-categories-tags); name uniqueness is **per-parent within a user** — enforced at the API layer, the old `categories_user_id_name` unique index is dropped in `migrate()`; `color` INTEGER nullable — palette index 1–8, NULL = auto (hash) (added task 08-30-category-tag-color-palette) |
| `tags` | `parent_id` TEXT nullable, same two-level semantics; name uniqueness per-parent at API layer (old unique index dropped); `ON DELETE CASCADE` with user; `color` INTEGER nullable — same semantics as categories |
| `entry_tags` | composite PK `(entry_id, tag_id)`; both FKs `ON DELETE CASCADE` |
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

## Two-level hierarchy (task 08-30-hierarchical-categories-tags)

`categories` / `tags` each have nullable `parent_id` pointing at a same-user **top-level** row. No DB FK — self-referential FK plus occupancy ordering is application-controlled. `migrate()` adds the column, creates `categories_user_parent` / `tags_user_parent` indexes `(user_id, parent_id)` with `IF NOT EXISTS`, and **drops** the legacy `(user_id, name)` unique indexes — those indexes would reject cross-parent duplicate names, so name uniqueness moved to the API layer (SQLite NULL semantics cannot express "top-level unique + per-parent unique" in one index).

Depth ≤ 2 is API-enforced (routes/categories.ts, routes/tags.ts): parent must itself be top-level (`409 CONFLICT "层级最多两级"`); a node with children cannot become a child (409); a node cannot be its own parent (409). Same-parent duplicate name → 409 `CONFLICT` (application-level check; `isUniqueViolation` kept as a backstop).

Deleting a parent cascades its children **only after** every child passes the same occupancy checks, inside one transaction (children first, then the parent). Entries may attach to any level — occupancy checks do not care about hierarchy.

Wrong: creating the `(user_id, parent_id)` index in `SCHEMA_SQL` — on an old db the column doesn't exist yet and `CREATE INDEX` fails (`no such column`). Correct: build the index in `migrate()` after the `ALTER TABLE`. Regression: `server/test/migration.test.ts`.

## Category occupancy

`DELETE /api/categories/:id` counts `time_entries` for that category (running or stopped). Count > 0 → 409 `CONFLICT`. Additionally counts `goals.category_id` references — a goal referencing the category blocks deletion with 409 `CONFLICT` `"该分类已被目标引用"` (task 08-30-goal-feature; `goalReferencesCategory` in `server/src/routes/goals.ts`, called after the entries check in `server/src/routes/categories.ts`). `time_entries.category_id` has no `ON DELETE CASCADE`; occupancy is an application rule (`server/src/routes/categories.ts`, `server/test/categories.test.ts`). With hierarchy (task 08-30-hierarchical-categories-tags): deleting a parent requires **all its children** to pass the same entries+goal checks too; the delete removes children then the parent in one transaction.

## Tag occupancy

`DELETE /api/tags/:id` deletes the tag directly; `entry_tags` rows are removed by `ON DELETE CASCADE`. **Exception (task 08-30-goal-feature)**: a goal referencing the tag (`goals.tag_id`) blocks deletion with 409 `CONFLICT` `"该标签已被目标引用"` (`goalReferencesTag`, checked in `server/src/routes/tags.ts` before the delete). Clearing the reference (`PATCH /api/goals/:id` with `tagId: null`) unblocks deletion.

`POST /api/timer/start` accepts optional `tagIds`; each id must belong to the user (404 inside the transaction). `EntryDto.tags` is ordered by tag name (`attachTags` in `server/src/entries.ts`).

## Goals

`goals` (task 08-30-goal-feature): user-scoped target definitions. Columns: `id`, `user_id` (ON DELETE CASCADE), `name`, `icon` (emoji string, default 🎯), `category_id` / `tag_id` (nullable, no cascade — deletion protection is the application rules above), `direction` (`'lt' | 'gt'`), `hours` (REAL > 0), `period_unit` (`'day' | 'week' | 'month'`), `due_date` (`YYYY-MM-DD` nullable), `created_at`. Index `goals_user_id`. New table via `CREATE TABLE IF NOT EXISTS` in `SCHEMA_SQL` — no `migrate()` entry needed. Progress is computed on read (`server/src/goals.ts` `listGoalsWithProgress`), never snapshotted; see [HTTP Routes](./http-routes.md) for the API contract and [Time and Timezone](./time-and-timezone.md) for `periodBounds`.
