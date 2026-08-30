# Time and Timezone

“Today” is a request-time interval in the caller’s IANA zone. It is not a column.

## Instants

Store and return UTC instants as ISO-8601 strings with `Z` (`deps.now().toISOString()`). TypeScript names: `startedAt` / `stoppedAt`. SQL names: `started_at` / `stopped_at`.

Clients never send `startedAt`. The server stamps start (and stop) from `deps.now()`. Tests inject `now` through `buildApp` / `createTestApp`.

## `tz` query

`GET /api/entries/today` and `GET /api/stats/today` require `?tz=`. `requireTz` in `server/src/time.ts` rejects missing, empty, or non-IANA values with 400 `VALIDATION` `"时区无效"`.

The browser sends `Intl.DateTimeFormat().resolvedOptions().timeZone` (`web/src/format.ts` `browserTz`). Do not read the container timezone. Docker images are typically UTC; China before 08:00 would otherwise see yesterday.

## Day bounds and clip

`todayBounds(tz, now)` uses luxon: interpret `now` as UTC, convert to `tz`, take `startOf("day")` .. plus one day, convert both ends back to UTC ISO-Z. The interval is half-open `[dayStart, dayEnd)`.

Proven fixture (`server/test/today.test.ts`): at `2026-08-25T02:00:00.000Z` with `Asia/Shanghai`,

- `dayStart` = `2026-08-24T16:00:00.000Z`
- `dayEnd` = `2026-08-25T16:00:00.000Z`

`clipSeconds(startedAt, stoppedAt, dayStart, dayEnd, now)` intersects the entry with that window. Running entries use `now` as the end. Overnight work started before midnight only counts today’s slice.

`listToday` selects entries that **overlap** the window (`startedAt < dayEnd` and (`stoppedAt` is null or `stoppedAt > dayStart`)), then attaches `clippedSeconds`. `statsToday` sums `clippedSeconds` per category, dropping non-positive slices, sorted by seconds descending.

## Range stats (`/api/stats/range`)

`statsRange(db, userId, tz, from, to, now, tagId?)` aggregates an arbitrary tz-local date range (closed interval `from`..`to`, ≤ `STATS_RANGE_MAX_DAYS = 92`). `rangeDayBounds(tz, from, to)` in `server/src/time.ts` derives per-day windows the same DST-safe way as `weekDayBoundsFrom` (luxon `plus({ days: i })` per day, never `start + i * 86400000`) and returns `null` for invalid dates or `from > to` (caller maps to 400 `VALIDATION`; > 92 days is also 400). One `overlap` query + optional tag subquery, then three aggregations: `days` (per-day clipped seconds, zero days included, `date` is tz-local `YYYY-MM-DD`), `categories` (range-clipped per category, desc), `tags` (`attachTags` result; multi-tag entries count their full clipped seconds under **each** tag — the tags sum may exceed `totalSeconds`, which is why the UI never shows a tags total; entries with no tags land in the `tagId: null` bucket, desc). Running entries clip at the injected `now`. Foreign `tagId` → 404 `NOT_FOUND`, same as `statsToday`. Tests: `server/test/stats-range.test.ts`.

`durationSeconds` is the unclipped length (`stoppedAt ?? now - startedAt`). Stats and the timer-page day total use clipped values.

## Week bounds and clip

`GET /api/entries/week?tz=` returns the ISO week (Monday 00:00 local → next Monday 00:00 local) as 7 day buckets.

`weekBounds(tz, now)` uses luxon `startOf("week")` (Monday start) and returns `{ weekStart, weekEnd }` as UTC ISO-Z. `weekDayBounds(tz, now)` returns the 7 `[dayStart_i, dayEnd_i)` windows.

DST rules (both verified across 12 zones × full year):

- Do **not** compute day windows as `weekStart + i * 86400000` — in DST zones the local midnight drifts by an hour. Derive each day from the local calendar (`weekStart.plus({ days: i })` / `plus({ days: i + 1 })`) so day 6's end equals `weekEnd` exactly.
- Do **not** compute the Sunday label as `weekEnd - 24h` — in a fall-back week that lands on Saturday 23:00. Use `weekEnd - 1ms` (or `weekStart + 6 days` via luxon).

`listWeek` runs one `overlap` query over the whole week window, then clips each entry per day window. Each day bucket keeps only entries with `clippedSeconds > 0` (same semantics as `listToday`); `durationSeconds` stays the unclipped full length. `days` is always 7 elements, Monday first.

## Date anchor (`date` query)

`GET /api/entries/today?tz=&date=YYYY-MM-DD` and `GET /api/entries/week?tz=&date=YYYY-MM-DD` accept an optional anchor date interpreted in `tz` (future dates allowed; the frontend owns that policy).

- Omitted → behavior identical to pre-`date` builds (`todayBounds`/`weekBounds` from `now`).
- `requireDate(date, tz)` in `server/src/time.ts` validates the format and real-calendar existence (`DateTime.fromISO` + `toISODate() === date` to reject rollover like `2025-02-30`); failure → 400 `VALIDATION` `"日期无效"`. Validate `tz` first — `date` interpretation needs it.
- `dateDayBounds` / `dateWeekBounds` / `dateWeekDayBounds` derive windows from the anchor; `todayBounds`/`weekBounds`/`weekDayBounds` share the same internal helpers (`dayBoundsFrom`/`weekBoundsFrom`/`weekDayBoundsFrom`) and keep their old signatures. `listWeek` anchors **all 7 day buckets** to the date's week, not just `weekStart/weekEnd` — otherwise day buckets and the week window diverge when `date` is in another week.
- `listToday(db, userId, tz, now, tagId?, date?)` / `listWeek(db, userId, tz, now, date?)`: when `date` is set, bounds come from the anchor; `clipSeconds`'s `now` stays `deps.now()` (safe: no running entries overlap a non-today window).

Proven fixture (`server/test/today.test.ts`): `date=2026-08-20` with `Asia/Shanghai` anchors the window to that local calendar day, independent of `now`.

## Goal period bounds (`periodBounds`)

`periodBounds(tz, unit: "day" | "week" | "month", now)` in `server/src/time.ts` (task 08-30-goal-feature) returns `{ windowStart, windowEnd }` as UTC ISO-Z for the current period containing `now` in `tz`: day reuses `todayBounds`, week reuses `weekBounds` (ISO Monday start), month = `zonedNow.startOf("month")` .. `plus({ months: 1 })` — luxon calendar arithmetic, never `+ 30*86400000` (DST drift). Each period is judged independently (a "week" goal resets every Monday); `dueDate` is the goal's whole expiry, compared as `dueDate < zonedNow.toISODate()` (tz-local string compare). Tests: `server/test/goals.test.ts` (Shanghai fixtures: cross-midnight day clip, running-entry clip at injected `now`, prior-week/prior-month exclusion).

## Dual implementation

`web/src/format.ts` has its own `clipSeconds` / `elapsedSeconds` so the timer page can tick without refetching. Keep the two implementations numerically aligned. Do not import `server/src/time.ts` from `web/`.

## Anti-patterns

- `weekStart + i * 86400000` for day windows (DST drift).
- `weekEnd - 24h` for the Sunday label (fall-back week lands on Saturday 23:00).
- `new Date().toISOString().slice(0, 10)` as “today”.
- Hard-coded `+8` hours instead of luxon + IANA.
- Using `durationSeconds` for category stats (that leaks yesterday’s slice into today).
- Defaulting missing `tz` to `UTC` instead of 400.
- Anchoring only `weekStart/weekEnd` from `date` while leaving `weekDayBounds` on `now` — day buckets and the week window must come from the same anchor.
