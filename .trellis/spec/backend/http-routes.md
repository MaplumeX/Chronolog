# HTTP Routes

`buildApp` in `server/src/app.ts` is the only composition root. Tests and `index.ts` both call it.

## `AppConfig` / `Deps`

```ts
type AppConfig = {
  dbPath: string;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  webDist?: string;
  now?: () => Date;
  logger?: boolean;
};
```

`Deps` (`server/src/db.ts`) is what routes receive: `{ db, sqlite, cookieSecure, sessionTtlSeconds, now }`. Pass `now` into domain helpers instead of calling `new Date()` inside queries so tests can freeze time.

Production listen is `index.ts` (`host: "0.0.0.0"`). Tests use Fastify `inject` with `logger: false`.

## Registering routes

One `registerXRoutes(app, deps)` per file. `app.ts` calls:

- `registerAuthRoutes`
- `registerCategoryRoutes`
- `registerTagRoutes`
- `registerTimerRoutes`
- `registerTodayRoutes`

New endpoints belong in an existing file if they share the resource, or a new `routes/*.ts` plus one line in `app.ts`. Keep `/api` as the prefix. JSON field names are camelCase.

## Current surface

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| POST | `/api/auth/register` | no | seeds default categories; Set-Cookie; 403 when `REGISTRATION_OPEN=false` |
| POST | `/api/auth/login` | no | Set-Cookie; replaces previous sid |
| POST | `/api/auth/logout` | cookie optional | always `{ ok: true }` |
| GET | `/api/auth/me` | session | 401 if logged out; returns `{ id, username, displayName \| null }` |
| GET | `/api/meta` | no | `{ registrationOpen }` for the login page |
| PATCH | `/api/profile` | yes | `{ username?, displayName? }`; username dup → 409; empty update → 400 |
| PATCH | `/api/account/password` | yes | revokes other sessions, keeps PATs |
| DELETE | `/api/account` | yes | password confirmation; FK cascade; clears cookie |
| GET | `/api/categories` | yes | includes `entryCount`, `parentId` (null = top level) |
| POST | `/api/categories` | yes | `{ name, color?, parentId? }`; `color` = palette index 1–8 or null (auto). Invalid (0/9/"red"/1.5) → 400. `parentId` hierarchy rules below |
| PATCH | `/api/categories/:id` | yes | `{ name?, color?, parentId? }` at least one (empty → 400); `color: null` clears the explicit color; `parentId: null` promotes to top level |
| DELETE | `/api/categories/:id` | yes | occupied (self or any child) → 409; cascades children in one transaction |
| GET | `/api/tags` | yes | includes `entryCount`, `parentId` |
| POST | `/api/tags` | yes | `{ name, color?, parentId? }`; duplicate under same parent → 409; color same as categories |
| PATCH | `/api/tags/:id` | yes | `{ name?, color?, parentId? }` at least one; duplicate under same parent → 409 |
| DELETE | `/api/tags/:id` | yes | cascades children (goal refs block) and unlinks entries |
| GET | `/api/timer/current` | yes | `{ entry: EntryDto \| null }` |
| POST | `/api/timer/start` | yes | `{ categoryId, description?, tagIds? }` |
| POST | `/api/timer/stop` | yes | no running → 409 |
| PATCH | `/api/timer/current` | yes | update running entry: `{ description?, categoryId?, tagIds? }` (zod `strictObject` — rejects `startedAt`/`stoppedAt`); trim description ≤ 200; no running → 409 `CONFLICT`; category/tags not owned → 404; returns `{ entry: EntryDto }` (task 08-30-edit-while-timing) |
| GET | `/api/entries/today?tz=` | yes | overlapping entries + `clippedSeconds` |
| GET | `/api/entries/week?tz=` | yes | ISO week (Mon–Sun) as 7 day buckets: `{ tz, weekStart, weekEnd, days: TodayEntries[] }` |
| GET | `/api/entries/boundary?tz=&start=&end=` | yes | entries adjacent to the `[start, end)` window: `{ tz, prevEntry: EntryDto \| null, nextEntry: EntryDto \| null }` (gap-slot feature). `start`/`end` are ISO instants (zod `z.iso.datetime()`, `start < end` else 400 `VALIDATION`); `tz` is validated with `requireTz` but does not drive window math — the frontend converts the day/week view window to absolute instants. `prevEntry` = latest right edge (`stoppedAt ?? ∞`) among entries with `startedAt < start` and (`stoppedAt IS NULL` or `stoppedAt <= start`); `nextEntry` = min `startedAt >= end`. Query lives in `listBoundary` (`server/src/entries.ts`), route in `routes/entries.ts`. |
| GET | `/api/stats/today?tz=&tagId=&rollup=` | yes | per-category clipped seconds; optional `tagId` filter (legacy — StatsPage now uses `/api/stats/range`; endpoint kept); `rollup=true|1` merges child-category seconds into the parent bucket (task 08-30-hierarchical-categories-tags) |
| GET | `/api/stats/range?tz=&from=&to=&tagId=&rollup=` | yes | range aggregation (task 08-29-refactor-stats-page): `days` (per-day clipped seconds incl. zero days, tz-local `YYYY-MM-DD`), `categories` (range-clipped, desc), `tags` (multi-tag entries count fully under each tag; `tagId: null` = no-tag bucket), `totalSeconds`; `rollup=true|1` merges child-category seconds into the parent bucket (`rollupCategories` in `server/src/entries.ts`; tags are **not** rolled up) |
| POST | `/api/entries` | yes | create: `{ description, categoryId, tagIds, startedAt, stoppedAt }` → 201 + `EntryDto`; overlap → 409 `OVERLAP` |
| PATCH | `/api/entries/:id` | yes | full update: `{ description, categoryId, tagIds, startedAt, stoppedAt }`; stopped entries only; overlap → 409 `OVERLAP` |
| DELETE | `/api/entries/:id` | yes | hard delete; missing or foreign → 404; running (`stoppedAt IS NULL`) → 409 `CONFLICT`; `entry_tags` removed by `ON DELETE CASCADE` (task 08-31-delete-time-entry) |

### Goals API (task 08-30-goal-feature)

Routes in `server/src/routes/goals.ts`; progress math in `server/src/goals.ts` (`listGoalsWithProgress`); tests in `server/test/goals.test.ts`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/goals?tz=` | yes | list + per-goal current-period progress. Returns `{ goals: GoalWithProgress[] }` — goal fields (`id, name, icon, categoryId: string\|null, tagId: string\|null, direction: "lt"\|"gt", hours, periodUnit: "day"\|"week"\|"month", dueDate: "YYYY-MM-DD"\|null, createdAt`) + `status: "active"\|"achieved"\|"expired"` + `progress: { currentSeconds: number\|null, targetSeconds }`. `tz` required (400 via `requireTz`). |
| POST | `/api/goals` | yes | `{ name, icon?, categoryId?, tagId?, direction, hours, periodUnit, dueDate? }` → 201 + goal |
| PATCH | `/api/goals/:id` | yes | partial update; `categoryId/tagId/dueDate: null` clears; at least one field else 400 |
| DELETE | `/api/goals/:id` | yes | hard delete |

Validation matrix: name trim 1..32 (400); icon 1..8 UTF-16 code units, default 🎯 (400); hours > 0 and ≤ 1000 (400); `direction`/`periodUnit` enums (400); `dueDate` real calendar date `YYYY-MM-DD` (luxon `fromISO` + `toISODate()` round-trip rejects `2026-02-30`, 400); `categoryId`/`tagId` must belong to the user (404); foreign goal id (PATCH/DELETE) → 404.

Progress semantics (R2/R5): matching = categoryId set → `time_entries.category_id = goal.category_id`; tagId set → `exists(entry_tags ...)` subquery (same pattern as `statsRange`'s tagFilter); both set → AND; neither → all entries. Window = `periodBounds(tz, periodUnit, now)`; sum `clipSeconds` over the window (running entries clip at `now`). `status`: expired when `dueDate < tz-local today` (`currentSeconds: null`, no aggregation); achieved = (gt && current ≥ target) || (lt && current < target); else active. "lt exceeded" is not a server state — the frontend derives it (lt && active && current ≥ target → red "已超限" badge).

`POST /api/entries` and `PATCH /api/entries/:id` (`server/src/routes/entries.ts`) are the only endpoints that accept client-sent `startedAt` / `stoppedAt` (PATCH is a full update, stopped entries only; POST creates a stopped entry directly — the timeline drag-to-create flow, task 08-27-timeline-drag-create). Both reuse the same zod `updateBody` and shared validators (`checkTimeOrder` / `checkCategory` / `checkTags` / `checkOverlap`).

Validation order inside the transaction — PATCH: entry owned (404) → stopped (409 `CONFLICT`) → category owned (404) → tags owned (404) → `stoppedAt > startedAt` (400) → overlap check (409 `OVERLAP`). POST: `stoppedAt > startedAt` (400) → category (404) → tags (404) → overlap (409) → insert with `newId()` → 201 + `getEntry(...)`. Overlap is half-open `[start, end)`: `other.startedAt < newStoppedAt AND (other.stoppedAt IS NULL OR other.stoppedAt > newStartedAt)`, excluding self (PATCH only); running entries (`stoppedAt IS NULL`) extend to infinity and participate; touching boundaries (`==`) do not conflict. Tags are replaced wholesale (delete + insert) on PATCH and inserted once on POST; `tagIds` are deduped (`[...new Set]`) in both.

The server does **not** constrain created/updated ranges to a day window — day-boundary clamping is a frontend concern (timeline drag clamps to the column's `[dayStart, dayEnd]`).

`EntryDto` (`server/src/entries.ts`) is the timer/today payload: `id`, `categoryId`, `categoryName`, `description`, `startedAt`, `stoppedAt`, `durationSeconds`, optional `clippedSeconds`, `tags: { id, name }[]` (ordered by name). Keep `web/src/api.ts` `TimeEntry` in sync.

## SPA fallback

When `WEB_DIST` exists, `@fastify/static` serves it. `setNotFoundHandler`:

- `/api*` or non-GET → JSON 404 `NOT_FOUND`
- other GET → `index.html` (client page switch has no URL router)

Dev: Vite `:5173` proxies `/api` to `:8080` (`web/vite.config.ts`). Cookie stays same-origin via the proxy.

## Hierarchy validation matrix (task 08-30-hierarchical-categories-tags)

Applies symmetrically to categories and tags (`routes/categories.ts` / `routes/tags.ts`):

| Check | Error |
|-------|-------|
| `parentId` not found or owned by another user | 404 `NOT_FOUND` |
| `parentId` refers to a non-top-level node | 409 `CONFLICT` `"层级最多两级"` |
| `parentId === id` (self-parent) | 409 `CONFLICT` |
| node has children and PATCH tries to make it a child | 409 `CONFLICT` `"层级最多两级"` |
| same name under the same parent (incl. top level) | 409 `CONFLICT` `"分类名已存在"` / `"标签名已存在"` |

`parentId: null` on PATCH promotes to top level; `undefined` leaves it unchanged. Default categories seed as top level. Tests: `server/test/categories.test.ts`, `tags.test.ts`, `migration.test.ts`.

## Anti-patterns

- Do not accept client `startedAt` / `stoppedAt` on start/stop.
- Do not add CORS or a second cookie domain — production is one origin.
- Do not call `new Date()` in domain code when `deps.now()` exists.
- Do not return drizzle row objects; map to DTO (join category name, compute durations).
