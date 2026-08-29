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
| GET | `/api/categories` | yes | includes `entryCount` |
| POST | `/api/categories` | yes | `{ name }` |
| PATCH | `/api/categories/:id` | yes | `{ name }` |
| DELETE | `/api/categories/:id` | yes | occupied → 409 |
| GET | `/api/tags` | yes | includes `entryCount` |
| POST | `/api/tags` | yes | `{ name }`; duplicate → 409 |
| PATCH | `/api/tags/:id` | yes | `{ name }`; duplicate → 409 |
| DELETE | `/api/tags/:id` | yes | direct delete; cascade unlinks entries |
| GET | `/api/timer/current` | yes | `{ entry: EntryDto \| null }` |
| POST | `/api/timer/start` | yes | `{ categoryId, description?, tagIds? }` |
| POST | `/api/timer/stop` | yes | no running → 409 |
| GET | `/api/entries/today?tz=` | yes | overlapping entries + `clippedSeconds` |
| GET | `/api/entries/week?tz=` | yes | ISO week (Mon–Sun) as 7 day buckets: `{ tz, weekStart, weekEnd, days: TodayEntries[] }` |
| GET | `/api/stats/today?tz=&tagId=` | yes | per-category clipped seconds; optional `tagId` filter (legacy — StatsPage now uses `/api/stats/range`; endpoint kept) |
| GET | `/api/stats/range?tz=&from=&to=&tagId=` | yes | range aggregation (task 08-29-refactor-stats-page): `days` (per-day clipped seconds incl. zero days, tz-local `YYYY-MM-DD`), `categories` (range-clipped, desc), `tags` (multi-tag entries count fully under each tag; `tagId: null` = no-tag bucket), `totalSeconds` |
| POST | `/api/entries` | yes | create: `{ description, categoryId, tagIds, startedAt, stoppedAt }` → 201 + `EntryDto`; overlap → 409 `OVERLAP` |
| PATCH | `/api/entries/:id` | yes | full update: `{ description, categoryId, tagIds, startedAt, stoppedAt }`; stopped entries only; overlap → 409 `OVERLAP` |

`POST /api/entries` and `PATCH /api/entries/:id` (`server/src/routes/entries.ts`) are the only endpoints that accept client-sent `startedAt` / `stoppedAt` (PATCH is a full update, stopped entries only; POST creates a stopped entry directly — the timeline drag-to-create flow, task 08-27-timeline-drag-create). Both reuse the same zod `updateBody` and shared validators (`checkTimeOrder` / `checkCategory` / `checkTags` / `checkOverlap`).

Validation order inside the transaction — PATCH: entry owned (404) → stopped (409 `CONFLICT`) → category owned (404) → tags owned (404) → `stoppedAt > startedAt` (400) → overlap check (409 `OVERLAP`). POST: `stoppedAt > startedAt` (400) → category (404) → tags (404) → overlap (409) → insert with `newId()` → 201 + `getEntry(...)`. Overlap is half-open `[start, end)`: `other.startedAt < newStoppedAt AND (other.stoppedAt IS NULL OR other.stoppedAt > newStartedAt)`, excluding self (PATCH only); running entries (`stoppedAt IS NULL`) extend to infinity and participate; touching boundaries (`==`) do not conflict. Tags are replaced wholesale (delete + insert) on PATCH and inserted once on POST; `tagIds` are deduped (`[...new Set]`) in both.

The server does **not** constrain created/updated ranges to a day window — day-boundary clamping is a frontend concern (timeline drag clamps to the column's `[dayStart, dayEnd]`).

`EntryDto` (`server/src/entries.ts`) is the timer/today payload: `id`, `categoryId`, `categoryName`, `description`, `startedAt`, `stoppedAt`, `durationSeconds`, optional `clippedSeconds`, `tags: { id, name }[]` (ordered by name). Keep `web/src/api.ts` `TimeEntry` in sync.

## SPA fallback

When `WEB_DIST` exists, `@fastify/static` serves it. `setNotFoundHandler`:

- `/api*` or non-GET → JSON 404 `NOT_FOUND`
- other GET → `index.html` (client page switch has no URL router)

Dev: Vite `:5173` proxies `/api` to `:8080` (`web/vite.config.ts`). Cookie stays same-origin via the proxy.

## Anti-patterns

- Do not accept client `startedAt` / `stoppedAt` on start/stop.
- Do not add CORS or a second cookie domain — production is one origin.
- Do not call `new Date()` in domain code when `deps.now()` exists.
- Do not return drizzle row objects; map to DTO (join category name, compute durations).
