# Research: auth-self-hosted

- Query: Session cookie vs JWT for a self-hosted multi-user app with username/password, open registration, no email verification. Minimum tables/fields. Cookie flags for local HTTP Docker vs HTTPS reverse proxy.
- Scope: mixed
- Date: 2026-08-25

## Recommendation

**Server-side sessions in SQLite + HttpOnly cookie.** Do not use JWT (access token in localStorage or a stateless JWT cookie) for this app.

- Register / login with username + password (Argon2id).
- Cookie holds an **opaque** session ID only.
- Logout **deletes the session row** (AC10).
- Same origin in Docker (Hono serves SPA + API) so no CORS and `SameSite=Lax` is enough.
- `Secure` is **off** for `http://localhost` compose; **on** when the operator puts HTTPS in front.

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/08-25-chronolog-mvp/prd.md` | R8–R11, R10 open register, no email verify; AC7–AC10 |
| Repo | No auth code |

### Session cookie vs JWT

| | Session cookie (pick) | JWT (reject for MVP) |
|---|---|---|
| Storage | SQLite `sessions` | Client (or cookie) |
| Logout (AC10) | `DELETE FROM sessions` | Need a denylist = a session table anyway |
| Revoke all devices | Delete rows by `user_id` | Same denylist |
| XSS | `HttpOnly` hides the ID | `localStorage` JWT is stealable |
| Size | ~32-byte ID | Claims on every request |
| Self-hosted first party | Cookie to same origin | Extra CSRF/Bearer plumbing |

OWASP: exchange the session ID with a cookie; do **not** put session IDs or JWTs in `localStorage` / `sessionStorage`. Session ID is a server-side lookup key, not a blob of user data.

JWT is not “more scalable” here: one SQLite file, tens of users. Stateless JWT fights AC10 (logout must actually lock the user out).

Sources: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Minimum tables

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- ulid / uuid
  username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,             -- Argon2id PHC string
  created_at    TEXT NOT NULL              -- UTC instant
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,            -- 32 bytes CSPRNG, base64url
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,               -- UTC
  created_at  TEXT NOT NULL
);

CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);
```

That is the auth surface. Categories and time entries stay on `user_id`.

Optional later (not MVP): `sessions.user_agent`, last-seen IP, idle timeout column.

Rules:

- Session ID: CSPRNG, ≥64 bits entropy (use 256 bits). Meaningless to the client.
- Regenerate session ID **after login** (session fixation).
- Logout: delete this row + `Set-Cookie` max-age=0.
- Expired rows ignored; opportunistic delete on read or a periodic sweep.
- Username unique, case-insensitive (`COLLATE NOCASE` or store normalized).
- No email, no verification token, no `accounts` / OAuth tables.

Password: Argon2id, m=19456 KiB, t=2, p=1 (OWASP). Library: `@node-rs/argon2`. No pepper required for MVP; if added, keep it in env, not in SQLite.

Open registration (R10) + no email (PRD risk): anyone who can reach the instance can create a user. Accept for MVP; rate-limit later.

### Cookie flags

Name the cookie something generic (`sid`), not `connect.sid`.

| Flag | Local HTTP Docker (`http://host:8080`) | HTTPS reverse proxy |
|---|---|---|
| `HttpOnly` | **true** | **true** |
| `Path` | `/` | `/` |
| `SameSite` | `Lax` | `Lax` (or `Strict` if you never land from an external link into an authed page) |
| `Secure` | **false** (else the browser drops it) | **true** |
| `Max-Age` / `Expires` | Idle ~7 days is fine for a personal tracker | Same |
| `Domain` | omit (host-only) | omit |
| `__Host-` prefix | no (requires Secure) | optional, recommended |

Env: `COOKIE_SECURE=false|true`. Do not key off `NODE_ENV` alone — self-hosted HTTP on a LAN is “production” without TLS.

If the operator terminates TLS on Caddy/nginx:

- App still sees HTTP unless you set `X-Forwarded-Proto`.
- Set `COOKIE_SECURE=true` in compose **or** trust `X-Forwarded-Proto=https` from the proxy only.
- Proxy must not strip `Set-Cookie`.

Same-origin (recommended stack): SPA and API on one port → cookie sent on `/api/*` with `credentials` same-origin. No `SameSite=None`.

Split Vite dev (`localhost:5173` → API `localhost:8080`): different ports are different origins. Either proxy `/api` through Vite (keep same origin) or temporarily allow that pair with `credentials: include` and `SameSite=Lax` on `localhost`. Prefer the Vite proxy.

CSRF: `SameSite=Lax` blocks cross-site POSTs. For MVP, same-origin + Lax is enough. Add a CSRF token later if the API is ever hosted on another site.

### Request flow

1. `POST /api/register` { username, password } → hash, insert user, insert default categories, create session, `Set-Cookie`.
2. `POST /api/login` → verify hash, new session row, rotate cookie.
3. Authed routes: read cookie → load session if `expires_at > now` → set `user_id`.
4. `POST /api/logout` → delete session, clear cookie.
5. Missing/invalid session → 401 (AC7).

Do not put the user id in the cookie.

### What not to pull in

- Better Auth / Auth.js: email verification, OAuth adapters, extra tables.
- JWT access + refresh: refresh store is a session table with more ways to get AC10 wrong.
- HTTP Basic as the browser session: no logout, credentials cached.

## Caveats / Not Found

- PRD does not require “logout all sessions” or idle vs absolute timeout. Use one absolute TTL (e.g. 7 days) and rolling extend on activity if you want less friction.
- `__Host-sid` is the OWASP-hardest cookie name but **cannot** be used on plain HTTP Docker; keep a single `sid` name and only flip `Secure`.
- No existing auth middleware in the empty repo; this is greenfield.
- Rate limiting / captcha: PRD explicitly not MVP.
