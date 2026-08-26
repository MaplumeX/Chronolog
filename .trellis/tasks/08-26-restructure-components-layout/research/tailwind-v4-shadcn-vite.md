# Tailwind v4 + shadcn/ui on this Vite app

Official path (https://ui.shadcn.com/docs/installation/vite):

1. In `web/`: `npm install tailwindcss @tailwindcss/vite`
2. Vite plugin: `tailwindcss()` next to `@vitejs/plugin-react`; keep existing `/api` proxy.
3. CSS entry: `@import "tailwindcss";` (replace most of `web/src/styles.css`).
4. Path alias `@/` → `web/src` in `web/tsconfig.json` + `web/vite.config.ts` (`@types/node` for `path`).
5. `npx shadcn@latest init` from `web/` (or with `--cwd web` from repo root). Base color chosen at init; style typically `new-york`.
6. Add only the primitives this app needs (Button, Input, Tabs, Dropdown Menu, Separator, Sidebar if we keep a rail).

Constraints for this repo:

- npm workspaces: dependencies belong in `web/package.json`, not the root.
- Do not add React Router; shadcn Sidebar/Tabs are layout, not routing.
- Lucide is shadcn’s default icon set. Current spec discourages extra icon libraries; once shadcn is in, Lucide is the project icon family (do not mix Phosphor).
- `WEB_DIST=../web/dist` production serve is unchanged; Tailwind is compile-time.

Out of this research: visual tokens (light/dark, radius) and which shadcn primitives are a product decision, not a stack fact.
