# Quality Guidelines

## Required

- `npm run typecheck` (server + web)
- `npm test` in `server/` (node:test). Cover: user isolation, stop-then-start, occupied category delete 409, today clip with `Asia/Shanghai`

## Forbidden

- Hono, Postgres (MVP), JWT in localStorage, `@earendil-works/pi-*`
- Client-supplied `started_at`
- Treating another user’s id as 403 with a distinct body (use 404)

## Tests

Assert HTTP status **and** `error.code`. Isolation tests use two users.
