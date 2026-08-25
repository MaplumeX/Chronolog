# Directory Structure

SPA in `web/` (Vite + React + TypeScript).

```
web/src/
├── main.tsx
├── App.tsx              # auth gate + page switch
├── api.ts               # fetch wrappers; 401 → setOnUnauthorized
├── format.ts            # tz, duration, categoryColor, clipSeconds
├── styles.css
├── components/Shell.tsx # dark nav: 计时 / 统计 / 分类
└── pages/
    ├── AuthPage.tsx
    ├── TimerPage.tsx    # timer bar + today list only
    ├── StatsPage.tsx    # today category totals
    └── CategoriesPage.tsx
```

New screens: a page file + a `PageId` on the shell. Shared HTTP stays in `api.ts`.
