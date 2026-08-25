# Error Handling

Throw `AppError(statusCode, code, message)` from `server/src/errors.ts`. Fastify `setErrorHandler` in `app.ts` maps it to JSON. Unknown errors → 500 `INTERNAL` with generic 中文 message (log the original).

## Response body

```json
{ "error": { "code": "VALIDATION", "message": "时区无效" } }
```

`message` is Chinese for the UI.

## Status map

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION` | zod / invalid IANA `tz` / empty name |
| 401 | `UNAUTHENTICATED` | missing or expired session |
| 404 | `NOT_FOUND` | resource missing **or** owned by another user (do not leak) |
| 409 | `CONFLICT` | username taken; category in use; stop with no timer |
| 500 | `INTERNAL` | unexpected |

Validate bodies with `parseBody(schema, body)` (first zod issue message).

## Common Mistake: UTC date as “today”

**Symptom**: Before 08:00 in China, “today” is yesterday.

**Cause**: Using container UTC midnight.

**Fix**: `requireTz` + `todayBounds` in `server/src/time.ts`; client sends `?tz=` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
