# Auth

Cookie session for browsers; personal access tokens (PAT) for non-browser clients (CLI / agents). Implementation: `server/src/auth.ts`, `server/src/routes/auth.ts`, `server/src/routes/tokens.ts`. Research background: archived `research/auth-self-hosted.md` on the MVP task.

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

## Personal access tokens (Bearer)

Non-browser clients authenticate with `Authorization: Bearer ctt_<32-byte base64url>` (PAT, task 08-27-cli-agent-auth). The browser never sends Bearer — it keeps using the cookie.

- Table `api_tokens`: `id`, `user_id` (cascade), `name`, `token_hash` (unique), `created_at`, `last_used_at`. No expiry, no scope (D2: full permissions).
- Plaintext format: `ctt_` + 32 CSPRNG bytes base64url (`newToken()` in `auth.ts`, same entropy source as `newSessionId`). Only SHA-256 hex is stored (`hashToken()`); the plaintext is returned exactly once on `POST /api/tokens`.
- `loadUser` checks the Bearer branch **only when an `Authorization` header is present** (hash lookup + `lastUsedAt` update, miss → null → 401). Without the header it goes straight to the cookie path, so browser requests pay zero extra cost. Revocation = row delete, immediate.
- Management API (all `requireUser`, cookie or Bearer both work): `POST /api/tokens` `{ name }` (1–64 chars, trimmed) → `{ id, name, token, createdAt }`; `GET /api/tokens` → list without hash/plaintext; `DELETE /api/tokens/:id` → `{ ok: true }`, unknown or cross-user id → 404.

## Isolation

A user only sees rows with their `user_id`. Looking up another user’s category id, starting a timer with it, or deleting it is 404 `NOT_FOUND` — same body as a missing id.

Cover this with two-user tests (`server/test/isolation.test.ts`). Do not add a distinct 403.

## Anti-patterns

- No JWT in cookies or `localStorage`.
- No `Authorization: Bearer` header **in the browser** — browser clients use the cookie; Bearer + PAT is for non-browser clients only (`server/src/routes/tokens.ts`), and the web TokensPage never attaches the header itself.
- Do not store or return token plaintext anywhere except the single `POST /api/tokens` response.
- Do not persist the session id in logs or error messages.
- Do not skip `replaceSession` on login because “they already have a cookie”.
