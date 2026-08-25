# Frontend Development Guidelines

SPA in `web/`: Vite 8, React 19, TypeScript. No React Router, no Redux/Zustand, no CSS framework. Production assets are `web/dist`, served by Fastify.

This is a single-repo Trellis project. npm workspace `web` is this layer.

---

## Pre-Development Checklist

Read these before changing `web/`:

1. [Directory Structure](./directory-structure.md)
2. [Component Guidelines](./component-guidelines.md) — Toggl-like shell; timer vs stats
3. [API Client](./api-client.md) — fetch, cookies, 401
4. [State Management](./state-management.md) and [Hook Guidelines](./hook-guidelines.md)
5. [Type Safety](./type-safety.md) if you add a payload field
6. [Quality Guidelines](./quality-guidelines.md)
7. Shared [Thinking Guides](../guides/index.md)

---

## Guidelines Index

| Guide | When to use |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | New page / shared module |
| [Component Guidelines](./component-guidelines.md) | Layout, copy, timer vs stats |
| [Hook Guidelines](./hook-guidelines.md) | Effects, interval, page-local fetch |
| [State Management](./state-management.md) | Session, running timer, page id |
| [API Client](./api-client.md) | `web/src/api.ts`, errors, credentials |
| [Type Safety](./type-safety.md) | DTO types vs ISO-Z instants |
| [Quality Guidelines](./quality-guidelines.md) | Chinese UI, typecheck, CSS |

---

## Quality Check

```bash
npm run typecheck -w web
npm run build -w web
```

There is no `web` test script. Verify UI by running the app (`npm run dev` or Docker) when behavior changes.

Also confirm:

- [ ] UI copy is Chinese (`index.html` is `lang="zh-CN"`)
- [ ] Per-category totals stay on `StatsPage` only
- [ ] All `fetch` goes through `api.ts` with `credentials: "same-origin"`
- [ ] Instants are formatted with `format.ts` + browser IANA zone
- [ ] New screens are a `pages/*.tsx` file plus a `PageId` on `Shell`
