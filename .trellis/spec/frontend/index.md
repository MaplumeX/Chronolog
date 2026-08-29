# Frontend Development Guidelines

SPA in `web/`: Vite 8, React 19, TypeScript, Tailwind CSS v4, shadcn/ui. No React Router, no Redux/Zustand. Production assets are `web/dist`, served by Fastify.

This is a single-repo Trellis project. npm workspace `web` is this layer.

---

## Pre-Development Checklist

Read these before changing `web/`:

1. [Directory Structure](./directory-structure.md)
2. [Component Guidelines](./component-guidelines.md) — sidebar shell; timer vs stats
3. [Design Tokens](./design-tokens.md) — teal dual theme, category palette
4. [API Client](./api-client.md) — fetch, cookies, 401
5. [State Management](./state-management.md) and [Hook Guidelines](./hook-guidelines.md)
6. [Type Safety](./type-safety.md) if you add a payload field
7. [Quality Guidelines](./quality-guidelines.md)
8. Shared [Thinking Guides](../guides/index.md)

---

## Guidelines Index

| Guide | When to use |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | New page / shared module |
| [Component Guidelines](./component-guidelines.md) | Shell, copy, timer vs stats, no-card layout |
| [Design Tokens](./design-tokens.md) | Theme colors, dual light/dark, category palette, radius, typography |
| [Hook Guidelines](./hook-guidelines.md) | Effects, interval, page-local fetch |
| [State Management](./state-management.md) | Session, running timer, page id |
| [API Client](./api-client.md) | `web/src/api.ts`, errors, credentials |
| [Type Safety](./type-safety.md) | DTO types vs ISO-Z instants |
| [Quality Guidelines](./quality-guidelines.md) | i18n copy, typecheck, Tailwind tokens |

---

## Quality Check

```bash
npm run typecheck -w web
npm run build -w web
```

There is no `web` test script. Verify UI by running the app (`npm run dev` or Docker) when behavior changes.

Also confirm:

- [ ] UI copy goes through i18n `t()` keys (`web/src/i18n/locales/`), zh/en keys in sync
- [ ] Per-category totals stay on `StatsPage` only
- [ ] All `fetch` goes through `api.ts` with `credentials: "same-origin"`
- [ ] Instants are formatted with `format.ts` + browser IANA zone
- [ ] New screens are a `pages/*.tsx` file plus a `PageId` on `Shell`
- [ ] Pages are not wrapped in shadcn `Card` / old `*-card` chrome
- [ ] Narrow windows use the sidebar drawer, not a new bottom nav
- [ ] New colors go through semantic tokens in `styles.css`, not hardcoded hex / rgba (see [Design Tokens](./design-tokens.md))
