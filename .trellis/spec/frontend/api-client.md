# API Client

All browser HTTP goes through `web/src/api.ts`. Pages import `api`, `ApiError`, and the DTO types. They do not call `fetch` directly.

## Transport

`request()`:

- `credentials: "same-origin"`
- Sets `Content-Type: application/json` when there is a body
- Parses JSON; empty body becomes `{}`
- Network failure → `ApiError(0, "NETWORK", "无法连接服务器")`
- Non-OK → `ApiError(status, error.code, error.message)` from `{ error: { code, message } }`; if the body has no `error` field, `code` falls back to `"ERROR"` and `message` falls back to the i18n `common.requestFailed` copy.

## 401 handling

`setOnUnauthorized` is registered in `App`. Any 401 calls it **except** `api.me()` which passes `{ authFail: false }` so a logged-out boot does not loop.

Login/register 401 (bad password) still fires `onUnauthorized`; that is harmless when `user` is already null.

## Types

Keep these next to the client, not in a separate `types.ts`:

- `User` (`displayName: string | null`), `Category` (`entryCount`, `color: number | null`, `parentId: string | null` — null = top level, task 08-30-hierarchical-categories-tags), `Tag` (`entryCount`, `color: number | null`, `parentId: string | null`), `TimeEntry` (`tags: { id, name }[]`), `TodayEntries`, `TodayStats`, `RangeStats`, `ApiToken` (`lastUsedAt: string | null`), `Meta` (`registrationOpen`), `Goal` (task 08-30-goal-feature: `direction: "lt" | "gt"`, `periodUnit: "day" | "week" | "month"`, `categoryId/tagId/dueDate: string | null`, `status: "active" | "achieved" | "expired"`, `progress: { currentSeconds: number | null, targetSeconds: number }` — mirrors `GoalWithProgress`; `api.goals(tz)` / `createGoal` / `updateGoal(id, body)` / `deleteGoal(id)`). Entries: `createEntry` / `updateEntry` / `deleteEntry(id)` (task 08-31-delete-time-entry)

They must match `EntryDto` / route return values on the server. Instants are `string` (ISO-Z). `stoppedAt: string | null`.

Today endpoints take `tz` and encode it:

```ts
`/api/entries/today?tz=${encodeURIComponent(tz)}`
`/api/stats/today?tz=${encodeURIComponent(tz)}&tagId=${encodeURIComponent(tagId)}`
`/api/stats/range?tz=${encodeURIComponent(tz)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&tagId=${encodeURIComponent(tagId)}`
```

`tz` comes from `browserTz()` in `format.ts`. `tagId` is optional; omit it for unfiltered stats. `from`/`to` (`/api/stats/range`) are tz-local `YYYY-MM-DD` (closed interval, ≤ 92 days); they are derived client-side from `browserTz()` local dates, never from UTC `toISOString()`. The range DTO also lives next to the client (`RangeStats`): `days` / `categories` / `tags` (`tagId: string | null`, null = no-tag bucket) / `totalSeconds`.

Hierarchy (task 08-30-hierarchical-categories-tags): `createCategory` / `updateCategory` / `createTag` / `updateTag` accept an optional `parentId` (null/undefined = top level). `statsRange` / `todayStats` accept an optional `rollup: boolean` — true appends `&rollup=true` and the server merges child-category seconds into the parent bucket. Tree ordering helpers live in `web/src/hierarchy.ts` (`sortHierarchical`, `topLevel`) — reuse them, don't re-implement parent/child sorting in pages.

## Error display

Pages catch `ApiError` and show `err.message` (already Chinese from the server). Unknown throws become a short Chinese fallback (`加载失败`, `操作失败`).

## Anti-patterns

- Do not add `Authorization` headers to browser requests — the browser authenticates with the cookie only. The sole exception is the TokensPage, which manages PATs through `/api/tokens` (create/list/revoke) and never attaches the header itself; Bearer is for non-browser clients (see [Auth](../backend/auth.md)).
- Do not store tokens in `localStorage` or cookies. The plaintext PAT is shown once in the TokensPage dialog; if the user closes it, the token must be revoked and recreated.
- Do not duplicate DTO types in page files.
- Do not default a missing `tz` query — the server will 400; always pass `browserTz()`.
