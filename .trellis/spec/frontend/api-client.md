# API Client

All browser HTTP goes through `web/src/api.ts`. Pages import `api`, `ApiError`, and the DTO types. They do not call `fetch` directly.

## Transport

`request()`:

- `credentials: "same-origin"`
- Sets `Content-Type: application/json` when there is a body
- Parses JSON; empty body becomes `{}`
- Network failure → `ApiError(0, "NETWORK", "无法连接服务器")`
- Non-OK → `ApiError(status, error.code, error.message)` from `{ error: { code, message } }`

## 401 handling

`setOnUnauthorized` is registered in `App`. Any 401 calls it **except** `api.me()` which passes `{ authFail: false }` so a logged-out boot does not loop.

Login/register 401 (bad password) still fires `onUnauthorized`; that is harmless when `user` is already null.

## Types

Keep these next to the client, not in a separate `types.ts`:

- `User` (`displayName: string | null`), `Category` (`entryCount`), `Tag` (`entryCount`), `TimeEntry` (`tags: { id, name }[]`), `TodayEntries`, `TodayStats`, `ApiToken` (`lastUsedAt: string | null`), `Meta` (`registrationOpen`)

They must match `EntryDto` / route return values on the server. Instants are `string` (ISO-Z). `stoppedAt: string | null`.

Today endpoints take `tz` and encode it:

```ts
`/api/entries/today?tz=${encodeURIComponent(tz)}`
`/api/stats/today?tz=${encodeURIComponent(tz)}&tagId=${encodeURIComponent(tagId)}`
```

`tz` comes from `browserTz()` in `format.ts`. `tagId` is optional; omit it for unfiltered stats.

## Error display

Pages catch `ApiError` and show `err.message` (already Chinese from the server). Unknown throws become a short Chinese fallback (`加载失败`, `操作失败`).

## Anti-patterns

- Do not add `Authorization` headers to browser requests — the browser authenticates with the cookie only. The sole exception is the TokensPage, which manages PATs through `/api/tokens` (create/list/revoke) and never attaches the header itself; Bearer is for non-browser clients (see [Auth](../backend/auth.md)).
- Do not store tokens in `localStorage` or cookies. The plaintext PAT is shown once in the TokensPage dialog; if the user closes it, the token must be revoked and recreated.
- Do not duplicate DTO types in page files.
- Do not default a missing `tz` query — the server will 400; always pass `browserTz()`.
