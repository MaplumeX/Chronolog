# Hook Guidelines

There is no `src/hooks/` library. Data fetching and clocks stay in `App` or the page that owns the screen.

## Patterns in use

**Session boot** (`App.tsx`): `useEffect` calls `api.me()` with `authFail: false` (see [API Client](./api-client.md)). `user === undefined` is the loading gate (`加载中…`); `user === null` is `AuthPage`.

**Elapsed clock** (`App.tsx`): while `current` is non-null, `setInterval` 1s updates `nowMs`. Do not persist elapsed. Always `elapsedSeconds(startedAt, nowMs)` from `format.ts`. Pass `nowMs` into `TimerPage` so the bar and the list tick together.

**Page fetch on mount**: `TimerPage` / `CategoriesPage` load in `useEffect` with `[]` and write into `useState`. `StatsPage` also polls every 5 seconds and uses a `cancelled` flag.

**Outside click**: `TimerPage` category menu uses `useRef` + document `mousedown`.

## When to extract a hook

Extract only if a third screen would copy the same effect. Until then, keep the effect in the page. Do not add `useAuth`, `useTimer`, or React Query for this SPA.

## Anti-patterns

- Do not derive elapsed from `entry.durationSeconds` while running — that snapshot goes stale. Use `nowMs - startedAt`.
- Do not start a second 1s interval inside `TimerPage` when `App` already provides `nowMs`.
- Do not skip the `cancelled` flag on `StatsPage` polling.
