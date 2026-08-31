# Error Handling

Throw `AppError(statusCode, code, message)` from `server/src/errors.ts`. Fastify `setErrorHandler` in `app.ts` maps it to JSON. Unknown errors → 500 `INTERNAL` with generic Chinese `"服务器错误"` (log the original, do not send the stack).

## Response body

```json
{ "error": { "code": "UNAUTHORIZED", "message": "请先登录" } }
```

`message` is Chinese for the UI. `code` is a stable English token. Tests that care about the contract assert **both** HTTP status and `error.code` (`server/test/auth.test.ts`).

## Status map

| HTTP | `code` | When |
|------|--------|------|
| 400 | `VALIDATION` | zod / invalid IANA `tz` / empty name |
| 401 | `UNAUTHORIZED` | missing, expired, or wrong credentials (`requireUser`, login, `/api/auth/me`) |
| 404 | `NOT_FOUND` | resource missing **or** owned by another user; unknown `/api` path |
| 409 | `CONFLICT` | username taken; category name taken; category in use; tag name taken; stop with no timer; edit or delete a running entry |
| 409 | `OVERLAP` | edited entry time range overlaps another entry (incl. running) |
| 500 | `INTERNAL` | unexpected |

There is no `UNAUTHENTICATED` code in this codebase. Do not introduce 403 for cross-user access — isolation tests expect 404 (`server/test/isolation.test.ts`).

API 404 (prefix `/api` or non-GET) also uses `{ error: { code: "NOT_FOUND", message: "未找到" } }`. Browser GET fallback may return `index.html` when `WEB_DIST` is set (`app.ts` `setNotFoundHandler`).

## Request validation

Validate JSON bodies with `parseBody(schema, body)`. It throws 400 `VALIDATION` using the **first** zod issue message (already Chinese in the schema).

Examples:

- Auth: `username` `/^[A-Za-z0-9_]{3,32}$/`, password min 8 (`server/src/routes/auth.ts`).
- Category: trim then min 1 / max 32 (`server/src/routes/categories.ts`).
- Timer start: `categoryId` required; `description` optional max 200 (`server/src/routes/timer.ts`).
- Route params: `parseBody(z.object({ id: z.string().min(1) }), req.params)`.

Do not add a second validator (Fastify JSON Schema, manual `if (!body.x)`). zod is the only request schema layer.

## Unique constraint

`isUniqueViolation` detects `SQLITE_CONSTRAINT_UNIQUE`. Map it at the route:

- register → 409 `"用户名已被使用"`
- create/rename category → 409 `"分类名已存在"`
- create/rename tag → 409 `"标签名已存在"`
- timer start → retry stop-then-start once, then let it fail

## Anti-patterns

- Do not `reply.code(401).send(...)` in a handler; throw `AppError`.
- Do not return 403 with a distinct body for another user’s id.
- Do not put English `message` values on user-facing errors.
- Do not treat container UTC midnight as “today” — that is 400/`VALIDATION` via `requireTz`, not a 500 (see [Time and Timezone](./time-and-timezone.md)).
