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

`durationSeconds` is the unclipped length (`stoppedAt ?? now - startedAt`). Stats and the timer-page day total use clipped values.

## Week bounds and clip

`GET /api/entries/week?tz=` returns the ISO week (Monday 00:00 local → next Monday 00:00 local) as 7 day buckets.

`weekBounds(tz, now)` uses luxon `startOf("week")` (Monday start) and returns `{ weekStart, weekEnd }` as UTC ISO-Z. `weekDayBounds(tz, now)` returns the 7 `[dayStart_i, dayEnd_i)` windows.

DST rules (both verified across 12 zones × full year):

- Do **not** compute day windows as `weekStart + i * 86400000` — in DST zones the local midnight drifts by an hour. Derive each day from the local calendar (`weekStart.plus({ days: i })` / `plus({ days: i + 1 })`) so day 6's end equals `weekEnd` exactly.
- Do **not** compute the Sunday label as `weekEnd - 24h` — in a fall-back week that lands on Saturday 23:00. Use `weekEnd - 1ms` (or `weekStart + 6 days` via luxon).

`listWeek` runs one `overlap` query over the whole week window, then clips each entry per day window. Each day bucket keeps only entries with `clippedSeconds > 0` (same semantics as `listToday`); `durationSeconds` stays the unclipped full length. `days` is always 7 elements, Monday first.

## Dual implementation

`web/src/format.ts` has its own `clipSeconds` / `elapsedSeconds` so the timer page can tick without refetching. Keep the two implementations numerically aligned. Do not import `server/src/time.ts` from `web/`.

## Anti-patterns

- `weekStart + i * 86400000` for day windows (DST drift).
- `weekEnd - 24h` for the Sunday label (fall-back week lands on Saturday 23:00).
- `new Date().toISOString().slice(0, 10)` as “today”.
- Hard-coded `+8` hours instead of luxon + IANA.
- Using `durationSeconds` for category stats (that leaks yesterday’s slice into today).
- Defaulting missing `tz` to `UTC` instead of 400.
