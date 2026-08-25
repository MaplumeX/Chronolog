# Backend Development Guidelines

Chronolog API lives in `server/`: Fastify 5, TypeScript ESM, drizzle-orm over SQLite, zod request bodies, luxon for calendar-day bounds.

This is a single-repo Trellis project. npm workspace `server` is this layer. Do not invent a `packages/backend` tree.

---

## Pre-Development Checklist

Read these before changing `server/`:

1. [Directory Structure](./directory-structure.md) — where a new file belongs
2. [HTTP Routes](./http-routes.md) — `/api` shape, `Deps`, injectable `now`
3. [Error Handling](./error-handling.md) — `AppError`, status/code matrix
4. [Auth](./auth.md) if the change touches sessions, cookies, or user isolation
5. [Time and Timezone](./time-and-timezone.md) if the change touches “today”, duration, or `tz`
6. [Database Guidelines](./database-guidelines.md) if the change touches schema or SQL
7. [Quality Guidelines](./quality-guidelines.md) — tests and forbidden stacks
8. Shared [Thinking Guides](../guides/index.md)

Skip logging unless you are adding a new unexpected-error path.

---

## Guidelines Index

| Guide | When to use |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | New modules, import style, naming |
| [HTTP Routes](./http-routes.md) | New endpoints, DTO, SPA fallback |
| [Database Guidelines](./database-guidelines.md) | Schema, WAL, running-timer index |
| [Auth](./auth.md) | Cookie `sid`, Argon2id, isolation 404 |
| [Time and Timezone](./time-and-timezone.md) | IANA `tz`, today clip, instants |
| [Error Handling](./error-handling.md) | `AppError`, zod, unique-constraint map |
| [Logging Guidelines](./logging-guidelines.md) | pino; never log secrets |
| [Quality Guidelines](./quality-guidelines.md) | typecheck, `node:test`, isolation |

---

## Quality Check

After backend changes:

```bash
npm run typecheck -w server
npm test -w server
```

Also confirm:

- [ ] New `/api` routes go through `requireUser` unless they are register/login/logout
- [ ] Failures throw `AppError` (or `parseBody`); JSON is `{ error: { code, message } }`
- [ ] Other users’ resources return 404 `NOT_FOUND`, not 403
- [ ] Instants are UTC ISO-Z from `deps.now().toISOString()`; clients do not send `startedAt`
- [ ] Tests inject `now` when the clock matters (`server/test/helpers.ts`)
