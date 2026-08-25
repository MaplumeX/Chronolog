# Cross-Layer Thinking Guide

Chronolog is three hops: SQLite row → Fastify JSON → React state. Bugs cluster on those hops.

## Map the flow first

```
Browser action
  → web/src/api.ts (camelCase JSON, cookie sid)
  → server/src/routes/* (zod / requireUser)
  → entries.ts / auth.ts / time.ts
  → SQLite (snake_case, UTC ISO-Z)
  → DTO back to the page
```

For each arrow: what is the type, who validates, what does failure look like?

## Chronolog boundaries

| Boundary | Contract | Owner |
|----------|----------|--------|
| Cookie `sid` | HttpOnly, Lax, path `/`, `COOKIE_SECURE` | `server/src/auth.ts` |
| Errors | `{ error: { code, message } }`; UI shows `message` | `AppError` + `web/src/api.ts` `ApiError` |
| Entry payload | `TimeEntry` / `EntryDto` | `entries.ts` and `api.ts` together |
| “Today” | `?tz=` IANA; `[dayStart, dayEnd)` UTC instants | `server/src/time.ts`; client `browserTz()` |
| Running timer | `stoppedAt === null`; one per user | DB unique index + `startOnce` |
| Isolation | other user’s id → 404 `NOT_FOUND` | every lookup uses `user_id` |

## Mistake: UTC date as “today”

Symptom: before 08:00 in China, the list is yesterday.

Cause: container clock is UTC; `toISOString().slice(0, 10)` is not the user’s calendar day.

Fix: client sends `tz`; server uses `todayBounds`. Tests freeze `now` and assert Shanghai bounds (`server/test/today.test.ts`). UI clocks use `formatClock(iso, tz)`, not the browser’s default zone alone for stored instants.

## Mistake: leaking existence across users

Symptom: 403 or a distinct message for “exists but not yours”.

Fix: `getOwnCategory` and timer start category lookup return 404 `"分类不存在"`. Isolation tests in `server/test/isolation.test.ts`.

## Mistake: field added on one side only

Adding `clippedSeconds` / `entryCount` / `categoryName` means:

1. SQL / drizzle / DTO
2. `web/src/api.ts` type
3. the page that renders it
4. a test that asserts it

`TimerPage` recomputes clip with `nowMs` even when the API sent `clippedSeconds`, because the snapshot would freeze the running row. Stats trust the server total and poll.

## Mistake: elapsed from a stale snapshot

`durationSeconds` on `GET /api/timer/current` is computed once. The bar must use `elapsedSeconds(startedAt, nowMs)` in the client.

## Checklist

Before implementation:

- [ ] Named the JSON field on both server DTO and `api.ts`
- [ ] Decided clip vs full duration
- [ ] Decided 400 vs 401 vs 404 vs 409
- [ ] Decided whether `tz` is required

After implementation:

- [ ] Round-trip: start → stop → today list → stats
- [ ] Two-user isolation if ids appear in the URL
- [ ] `Asia/Shanghai` fixture if “today” moved
- [ ] Chinese `error.message` still correct in the UI
