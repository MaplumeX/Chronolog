# Research: today-timezone

- Query: How to define “today” for list + category totals when the server is UTC in Docker and users may be in Asia/Shanghai. Store instants in UTC; API timezone vs calendar date; DST / off-by-one risks.
- Scope: mixed
- Date: 2026-08-25

## Recommendation

- **Store only UTC instants** (`started_at`, `stopped_at` as ISO-8601 `...Z` text or INTEGER unix ms). Never store “local wall time” without a zone.
- **Do not use the container’s timezone** (`TZ=UTC` is fine and should stay UTC).
- **API: client sends IANA zone** (`?tz=Asia/Shanghai` or `X-Timezone: Asia/Shanghai`). Server computes that zone’s current calendar date and the half-open UTC interval `[dayStart, dayEnd)`.
- Optional extra: `?date=YYYY-MM-DD` to pin a civil date in that zone (MVP can ignore this and always mean “today”).
- List + category totals: entries that **overlap** the interval, duration **clipped** to the interval. Running entries use `now` as the exclusive end.

Do not send a naive `YYYY-MM-DD` without a zone, and do not let the server assume UTC midnight is “today.”

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/08-25-chronolog-mvp/prd.md` | R4 at least today’s list; open question on 今日分类合计 |
| Repo | No time-entry schema yet |

### Why UTC storage

A start/stop is an **instant** (user clicked Start). UTC (or unix ms) is unambiguous across Docker hosts, DST, and future zone-rule changes.

```
started_at = 2026-08-24T16:30:00.000Z   -- stored
-- Asia/Shanghai local: 2026-08-25 00:30
```

Display converts with the IANA name. Duration is `stopped_at - started_at` (or `now - started_at` if running) — no timezone involved.

Sources: [Store UTC, convert on display](https://devryo.com/en/blog/timezone-guide), [Unix timestamps are UTC](https://www.spark.money/tools/timestamp-converter).

### What “today” is

“Today” is a **civil date in the user’s zone**, not the server’s UTC date.

For `tz = Asia/Shanghai` on 2026-08-25:

| Bound | Local | UTC instant |
|---|---|---|
| dayStart inclusive | 2026-08-25 00:00:00 | `2026-08-24T16:00:00.000Z` |
| dayEnd exclusive | 2026-08-26 00:00:00 | `2026-08-25T16:00:00.000Z` |

China is UTC+8 with **no DST since 1991**, so this offset is stable for `Asia/Shanghai`. Still pass the IANA name, not `+08:00`, so Xinjiang (`Asia/Urumqi`, unofficial UTC+6) and non-China users work later.

Sources: [DST by country — China ended DST 1991](https://en.wikipedia.org/wiki/Daylight_saving_time_by_country), [IANA Asia/Shanghai](https://en.wikipedia.org/wiki/Time_in_China).

### How the API should accept timezone

Preferred (MVP):

```
GET /api/entries/today?tz=Asia/Shanghai
GET /api/totals/today?tz=Asia/Shanghai
```

or header `X-Timezone: Asia/Shanghai`.

Browser: `Intl.DateTimeFormat().resolvedOptions().timeZone` (usually `Asia/Shanghai` in China).

Server:

1. Validate `tz` against IANA (`Temporal` / `Intl` / a tz lib). Unknown → `400`.
2. `today = now` converted to that zone’s `YYYY-MM-DD`.
3. `dayStart` / `dayEnd` = that date’s local midnight and next midnight, as UTC instants.
4. Query overlap (below).

**Reject as primary:** client-computed UTC `from`/`to` only. Faster for the server, but every client can disagree about “today,” and a bug becomes wrong totals. Client range is OK as an *internal* helper after the server owns the zone.

**Reject:** store `users.timezone` in MVP. Extra settings UI; a laptop in Shanghai and a trip still want the **browser zone** for “today.” Persist later if reports need a stable profile zone.

**Reject:** `TZ=Asia/Shanghai` on the container. That makes *every* user share one zone and breaks UTC logs.

### Overlap query (list + totals)

Include a row if it intersects `[dayStart, dayEnd)`:

```
started_at < dayEnd
AND (stopped_at IS NULL OR stopped_at > dayStart)
```

Clipped duration for totals:

```
clipStart = max(started_at, dayStart)
clipEnd   = min(stopped_at ?? now, dayEnd)
seconds   = max(0, clipEnd - clipStart)
```

Sum `seconds` grouped by `category_id` for 今日分类合计. Day header total = sum of those.

This is required because a timer started at 23:00 local and stopped at 01:00 next day belongs to **both** civil dates (90 min yesterday, 60 min today). Using `date(started_at)` in UTC (or even `date(started_at, tz)` without clip) is wrong.

Running timer: use `now`; if it started before `dayStart`, only the piece after midnight counts toward **today**.

### DST and off-by-one

| Bug | What happens | Mitigation |
|---|---|---|
| UTC date as “today” | 00:00–08:00 in China is still “yesterday” in UTC | Always convert via IANA zone |
| Naive `YYYY-MM-DDTHH:mm:ss` with no offset | Server parses as UTC → 8h shift | Require `Z` / offset on write; generate `started_at` **on the server** at Start |
| `+08:00` instead of `Asia/Shanghai` | Fine today; breaks if DST returns or for other zones | IANA name for “today”; UTC instants for storage |
| DST spring-forward (US/EU) | Local 02:30 may not exist; 23h civil day | Use a tz library, not `+ 24*3600` |
| DST fall-back | Local 01:30 exists twice; 25h civil day | Same; half-open `[start, nextMidnight)` is correct |
| `Asia/Shanghai` DST | None since 1991; historical 1986–1991 only | Still use IANA, not a hardcoded +8 |
| Next-midnight via `+ 86400s` | Wrong on DST days (23h/25h) | Convert local `date+1 00:00` in-zone to instant |
| Floating `CURRENT_TIMESTAMP` in SQLite | Depends on connection `utc` | Store `strftime('%Y-%m-%dT%H:%M:%fZ','now')` or unix ms |

Node: `Intl` or `luxon` / `date-fns-tz` to get zone offset. Avoid adding 8 hours by hand.

Toggl’s list API takes `start_date` / `end_date` as ISO instants or `YYYY-MM-DD`; Chronolog should not copy the ambiguous `YYYY-MM-DD` without a zone.

### Server vs client display

- API returns UTC instants + maybe `tz` echo.
- UI formats with `new Date(iso).toLocaleString(undefined, { timeZone })`.
- Elapsed tick is timezone-free.

## Caveats / Not Found

- PRD does not lock 今日分类合计; overlap math is the same for the today list even if totals slip a version.
- `Asia/Urumqi` exists in tzdb; most Chinese browsers still report `Asia/Shanghai`. Do not override the browser zone unless the user asks.
- SQLite has no timestamptz; TEXT ISO-Z or INTEGER ms are both fine. Pick one in design and stick to it.
- Temporal API in Node is still incomplete depending on version; do not require it for MVP.
