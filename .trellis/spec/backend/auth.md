# Auth

Cookie session, not JWT. Implementation: `server/src/auth.ts` and `server/src/routes/auth.ts`. Research background: archived `research/auth-self-hosted.md` on the MVP task.

## Cookie

Name: `sid`. Options from `cookieOpts(deps)`:

| Flag | Value |
|------|--------|
| httpOnly | true |
| path | `/` |
| sameSite | `lax` |
| secure | `deps.cookieSecure` (`COOKIE_SECURE=true` only behind HTTPS) |
| maxAge | `deps.sessionTtlSeconds` (default 604800) |

Default Docker / local HTTP keeps `COOKIE_SECURE=false`. If you set Secure on plain HTTP, browsers drop the cookie (README).

## Passwords and ids

- Hash: `@node-rs/argon2` Argon2id, `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`.
- User / category / entry ids: `newId()` → `randomUUID()`.
- Session ids: `newSessionId()` → 32 CSPRNG bytes, base64url. Do not use UUID for session ids.

## Session lifecycle

- `createSession` inserts a row with `expiresAt = now + TTL`.
- `replaceSession` deletes the previous `sid` (if the browser sent one) then creates a new id. Call it on **register and login** to avoid session fixation (`server/test/auth.test.ts`).
- `loadUser` returns `null` when missing, unknown, expired (and deletes the expired row), or user gone.
- `requireUser` throws `AppError(401, "UNAUTHORIZED", "请先登录")`.
- Logout deletes the session row and `clearSessionCookie`.

Public: `POST /api/auth/register`, `POST /api/auth/login`. `GET /api/auth/me` uses `loadUser` and still 401s when logged out. Every other `/api/*` route must call `requireUser`.

Login compares the password even when the user is missing (`user ? verify : false`) so timing does not advertise existence. Failure is 401 `UNAUTHORIZED` `"用户名或密码错误"`. Duplicate username (NOCASE) is 409 `CONFLICT`.

## Isolation

A user only sees rows with their `user_id`. Looking up another user’s category id, starting a timer with it, or deleting it is 404 `NOT_FOUND` — same body as a missing id.

Cover this with two-user tests (`server/test/isolation.test.ts`). Do not add a distinct 403.

## Anti-patterns

- No JWT in cookies or `localStorage`.
- No `Authorization: Bearer` header.
- Do not persist the session id in logs or error messages.
- Do not skip `replaceSession` on login because “they already have a cookie”.
