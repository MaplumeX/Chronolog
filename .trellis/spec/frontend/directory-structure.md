# Directory Structure

```
web/
├── index.html
├── vite.config.ts          # /api → http://127.0.0.1:8080
├── src/
│   ├── main.tsx
│   ├── App.tsx             # auth gate + page switch + elapsed clock
│   ├── api.ts              # fetch wrappers + DTO types + ApiError
│   ├── format.ts           # tz, duration, clocks, categoryColor, clipSeconds
│   ├── styles.css          # one global sheet; CSS variables on :root
│   ├── components/
│   │   └── Shell.tsx       # dark nav: 计时 / 统计 / 分类
│   └── pages/
│       ├── AuthPage.tsx
│       ├── TimerPage.tsx
│       ├── StatsPage.tsx
│       └── CategoriesPage.tsx
└── dist/                   # production; Fastify serves via WEB_DIST
```

## Where new code goes

| Kind | Put it |
|------|--------|
| New screen | `pages/XPage.tsx` + add a `PageId` in `Shell.tsx` + render branch in `App.tsx` |
| Shared chrome | `components/` (today only `Shell`) |
| HTTP + payload types | `web/src/api.ts` |
| Duration / timezone / color | `web/src/format.ts` |
| Visual style | `web/src/styles.css` (no CSS modules, no Tailwind) |

There is no `src/hooks/`, `src/store/`, or `src/router/`. Do not add those folders for a single helper.

Vite imports omit extensions (`from "./App"`). Do not copy the server’s `.js` suffix style into `web/`.
