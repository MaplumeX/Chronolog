# Quality Guidelines

## Commands

```bash
npm run typecheck -w web
npm run build -w web
```

Root `npm run typecheck` includes web. There is no frontend unit-test runner.

## Product constraints

- UI language: Chinese.
- `html lang="zh-CN"`.
- Per-category totals: `StatsPage` only. Timer page may show a day grand total and a vertical timeline of entries (not a per-category breakdown).
- Do not call `api.stop()` on `beforeunload`.
- Do not store JWT or `sid` in `localStorage`. Sidebar may use its own UI cookie for collapsed state; that is not auth.
- Do not add a public marketing page.

## CSS

`web/src/styles.css`: `@import "tailwindcss"`, shadcn `:root` tokens, and a small timeline geometry block (`timeline-inner`, `timeline-block`, `now-line`). Page layout uses Tailwind utilities + shadcn components.

Light, neutral gray. No beige `--page`. No `.dark` class toggle.

Prefer existing primitives (`Button`, `Input`, `Table`, `DropdownMenu`, `Sidebar`) over new global classes. Timeline absolute positioning is the exception.

## Manual checks when UI changes

Exercise as a user: register, start/stop, switch 计时 / 统计 / 分类, logout, refresh while running. Confirm the timer still runs after refresh.

Layout: desktop expand/collapse the sidebar (icon rail reclaims width). At a narrow window (`<768px`) open the drawer, switch pages, and logout. Do not add a second mobile nav.
