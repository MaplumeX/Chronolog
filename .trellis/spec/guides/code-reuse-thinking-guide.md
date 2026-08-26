# Code Reuse Thinking Guide

Search before adding a helper. Chronolog is small; a second copy of clip math or a third `fetch` wrapper will drift.

## Already owned

| Need | Use |
|------|-----|
| HTTP | `web/src/api.ts` `request` / `api.*` |
| API error | `ApiError` |
| Chinese duration / clock / tz | `web/src/format.ts` |
| Server day math | `server/src/time.ts` |
| Entry queries / DTO | `server/src/entries.ts` |
| Session / ids / password | `server/src/auth.ts` |
| Body parse | `parseBody` in `errors.ts` |
| Unique constraint | `isUniqueViolation` |
| Test app | `server/test/helpers.ts` `createTestApp` |
| Default categories | `DEFAULT_CATEGORIES` in `schema.ts` |

Do not invent a second `utils.ts` or `hooks/useFetch.ts` that re-wrap these. `web/src/lib/utils.ts` exists only for shadcn `cn()`.

## Dual `clipSeconds`

`server/src/time.ts` and `web/src/format.ts` both implement clip to `[dayStart, dayEnd)`. That duplication is intentional (no shared package). If you change the interval (inclusive end, rounding), change **both** and extend `server/test/today.test.ts`.

`durationSeconds` (server) and `elapsedSeconds` (web) are the unclipped length. Stats must not use them.

## Payload types

If a page starts writing `type Entry = { ... }`, stop. Extend `web/src/api.ts`. If two routes return the same entry shape, they already share `EntryDto`.

## Constants

Category seed names, cookie name `sid`, error codes (`VALIDATION`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `INTERNAL`), and Argon2 parameters have one owner. Copying a code string into a test is fine; copying Argon2 settings into a route is not.

## When not to abstract

- A one-off `cancelled` flag in `StatsPage` polling
- A one-off className string on a page
- Lucide icons already imported in `Shell` / `TimerBar` (do not add a second icon pack)

Do not build a generic `useInterval` or `Select` until a third call site exists.

## After multi-file edits

```bash
rg "clipSeconds|UNAUTHORIZED|started_at|DEFAULT_CATEGORIES" server web
```

Confirm schema.ts and `SCHEMA_SQL` in `db.ts` still match.
