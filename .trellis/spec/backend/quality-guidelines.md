# Quality Guidelines

## Required commands

```bash
npm run typecheck          # server + web
npm test                   # server + web (root chains both workspaces)
npm test -w server         # server only: tsx --test test/*.test.ts
npm run test:coverage      # server + web coverage
npm run test:coverage -w server  # server only: tsx --test --experimental-test-coverage --test-coverage-include='src/**' test/*.test.ts
```

Server `tsconfig`: `strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`. ESM, Node 22+.

## Tests

Use `node:test` + Fastify `inject`. Shared setup: `server/test/helpers.ts`.

- Temp sqlite file per test app; `afterEach` → `t.close()` (closes Fastify and deletes the temp dir).
- Freeze time with `createTestApp({ now: () => now })` and reassign the captured `now` variable (see `server/test/today.test.ts`).
- Auth: send `cookieHeader(sid)`, never a Bearer token.
- Isolation tests use two users (`alice_iso` / `bob_iso` in `isolation.test.ts`).
- Assert HTTP status. For error-shape tests, also assert `error.code` (auth unauthenticated suite).
- Cover at least: user isolation, stop-then-start, occupied category 409, today clip with `Asia/Shanghai`.

There are no frontend unit tests. Do not block a backend change on Playwright unless the task asks for it.

## Forbidden stacks (MVP)

Do not add:

- Hono, Express, Next.js
- Postgres / Prisma
- JWT, sessions in `localStorage`
- `@earendil-works/pi-*` (agent is out of scope)
- drizzle-kit destructive migrations
- Client-supplied `started_at`
- 403 bodies that distinguish “exists but not yours” from missing

## Review focus

- Cross-user id in the URL or body → 404, same message as missing.
- Unique indexes still match the drizzle `schema.ts` and `SCHEMA_SQL`.
- Chinese `error.message` for anything the UI displays.
