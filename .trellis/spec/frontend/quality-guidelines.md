# Quality Guidelines

## Commands

```bash
npm run typecheck -w web
npm run build -w web
```

Root `npm run typecheck` includes web. There is no frontend unit-test runner.

## Product constraints

- UI language: i18n via `i18next` + `react-i18next` (`web/src/i18n/`). Default `zh`, optional `en`. All UI copy goes through `t()` keys in `web/src/i18n/locales/zh.ts` / `en.ts` (keys must stay in sync — `en` is typed as `Record<keyof typeof zh, string>`).
- Language persistence: `localStorage` key `chronolog.lang` (values `zh` | `en`), read/write wrapped in try/catch (storage may be unavailable). First visit defaults to `zh` — do not add `i18next-browser-languagedetector` (it would override the default).
- `html lang` is synced at runtime by `i18n/index.ts` (`languageChanged` → `document.documentElement.lang`); `index.html` keeps `lang="zh-CN"` as the static default.
- Do not translate: brand `Chronolog`, user-generated content (category names, descriptions), and backend `ApiError.message` (shown verbatim). Frontend-owned fallback copy (`errors.network`, `common.requestFailed`, etc.) is translated.
- Date/time formatting in `format.ts` uses `localeFor(i18n.language)` (`zh` → `zh-CN`); `formatDuration` (`h:mm:ss`) and `categoryColor` are language-independent.
- Per-category totals: `StatsPage` only. Timer page may show a day grand total and a vertical timeline of entries (not a per-category breakdown).
- Do not call `api.stop()` on `beforeunload`.
- Do not store JWT or `sid` in `localStorage`. Sidebar may use its own UI cookie for collapsed state; that is not auth.
- Do not add a public marketing page.

## CSS

`web/src/styles.css`: `@import "tailwindcss"`, shadcn `:root` / `.dark` tokens (teal cool theme, light + dark), and a small timeline geometry block (`timeline-inner`, `timeline-block`, `now-line`). Page layout uses Tailwind utilities + shadcn components. See [Design Tokens](./design-tokens.md).

Dual theme (light / dark) via the `.dark` class, switched by `ThemeSwitcher` / `use-theme`. No beige `--page`. Do not hardcode raw colors in components or CSS — consume semantic tokens / `color-mix` derivations instead.

Prefer existing primitives (`Button`, `Input`, `Table`, `DropdownMenu`, `Sidebar`) over new global classes. Timeline absolute positioning is the exception.

## Manual checks when UI changes

Exercise as a user: register, start/stop, switch 计时 / 统计 / 分类, logout, refresh while running. Confirm the timer still runs after refresh.

Layout: desktop expand/collapse the sidebar (icon rail reclaims width). At a narrow window (`<768px`) open the drawer, switch pages, and logout. Do not add a second mobile nav.
