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

## Persistence

The only persistence is the HttpOnly `sid` cookie. No `localStorage`, no JWT, no saved elapsed.

Dev: Vite proxy keeps `/api` on the same origin as the page so `credentials: "same-origin"` sends the cookie. Production: Fastify serves both.

## Anti-patterns

- Do not keep a second copy of `user` inside pages.
- Do not use URL pathnames for tabs (there is no router; refresh always boots then shows 计时).
- Do not stop the running timer in client-only state without `api.stop()` — the server row is the source of truth.
