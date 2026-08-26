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
- Do not store JWT or `sid` in `localStorage`.
- Do not add a public marketing page.

## CSS

One file: `web/src/styles.css`. Colors and fonts are CSS variables on `:root`. Prefer existing classes (`timer-bar`, `timeline-card`, `stats-card`, `ghost`, `danger`, `error`) over new inline styles. Small exceptions already exist (`StatsPage` bar width).

## Manual checks when UI changes

Exercise as a user: register, start/stop, switch 计时 / 统计 / 分类, logout, refresh while running. Confirm the timer still runs after refresh. If layout changed, check a narrow window — the shell is desktop-first and there is no separate mobile nav yet; do not silently invent one.
