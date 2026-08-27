# State Management

No Redux, Zustand, or context providers beyond React defaults.

## App-owned state

`App.tsx` holds:

- `user: User | null | undefined` — session
- `page: PageId` — shell tab
- `current: TimeEntry | null` — running timer
- `nowMs` — clock for elapsed

`setOnUnauthorized` clears `user` and `current` so a 401 on a later request returns to login.

After login/register, `AuthPage` calls `onAuthed(user)`. After logout, call `api.logout` then clear local state (logout errors are ignored).

When `user` becomes set, `App` loads `api.current()` into `current`. `TimerPage` can replace `current` via `onCurrent` after start/stop.

## Page-owned state

Each page keeps its own list/error/form state. Do not lift today’s entries or category tables into `App` unless a second surface needs them at the same time.

`TimerPage` recomputes the visible day total from `today.dayStart` / `dayEnd` plus `nowMs` (`clipSeconds` in `format.ts`). That is display state, not a store.

`TimerPage` also owns a `view: "day" | "week"` state (default `"day"`, not persisted) and the week data (`WeekEntries | null`). Week data loads lazily on first switch to the week view; after start/stop, refresh the week data too if it was already loaded, so switching back shows fresh entries.

`TimerPage` also owns a `date: string | null` view anchor (`null` = today/this week), persisted in `localStorage["chronolog-date-view"]` (try/catch, garbage values treated as null). Any date change or day↔week view switch re-fetches the target view's data for that `date` — never reuse cached week data across date changes (stale-data bug fixed in the date-switcher task). `DateNav` renders the `← [label] → [今天]` navigation; picking today from the calendar normalizes back to `null`.

## Persistence

The only persistence is the HttpOnly `sid` cookie. No JWT, no saved elapsed.

One exception: theme preference is persisted in `localStorage["chronolog-theme"]` (`"light" | "dark" | "system"`, missing = `"system"`) by `use-theme.ts`. The inline script in `index.html` applies the `.dark` class before React mounts to avoid flash; `useTheme()` in `App.tsx` owns the state and the `matchMedia` listener (registered only in `system` mode). Wrap all `localStorage` access in `try/catch` — privacy mode throws `SecurityError`.

Second exception: the timer page's viewed date is persisted in `localStorage["chronolog-date-view"]` (`"YYYY-MM-DD"` or removed = today). Same try/catch rule; invalid/garbage values fall back to null (today).

Dev: Vite proxy keeps `/api` on the same origin as the page so `credentials: "same-origin"` sends the cookie. Production: Fastify serves both.

## Anti-patterns

- Do not keep a second copy of `user` inside pages.
- Do not use URL pathnames for tabs (there is no router; refresh always boots then shows 计时).
- Do not stop the running timer in client-only state without `api.stop()` — the server row is the source of truth.
