# Hook Guidelines

Do not grow `src/hooks/` with ad-hoc business hooks. The one deliberate exception is `use-timer-controller.tsx`: it holds all Timer-page state/actions because `TimerBar` (Shell top bar) and `Timeline` (content area) are assembled in different places by `App` and must share state. `App` calls it once at the top level (hook rules) with `enabled: Boolean(user) && page === "timer"`; when `enabled` is false it makes no requests. Do not call it a second time or from child components. Other data fetching and clocks stay in `App` or the page that owns the screen.

Infrastructure hooks are allowed: `use-theme.ts` (theme mode state + `matchMedia` listener + `localStorage` persistence) is called once at the top of `App.tsx` and passed down as props — do not call it again in child components.

## Patterns in use

**Session boot** (`App.tsx`): `useEffect` calls `api.me()` with `authFail: false` (see [API Client](./api-client.md)). `user === undefined` is the loading gate (`加载中…`); `user === null` is `AuthPage`.

**Elapsed clock** (`App.tsx`): while `current` is non-null, `setInterval` 1s updates `nowMs`. Do not persist elapsed. Always `elapsedSeconds(startedAt, nowMs)` from `format.ts`. Pass `nowMs` into `useTimerController` so the bar and the list tick together.

**Page fetch on mount**: `useTimerController` (Timer data, guarded by `enabled`) / `CategoriesPage` load in `useEffect` and write into `useState`. `StatsPage` also polls every 5 seconds and uses a `cancelled` flag.

**Category menu**: `CategoryPicker` uses shadcn `DropdownMenu`, not a document `mousedown` listener.

## When to extract a hook

Extract only if a third screen would copy the same effect. Until then, keep the effect in the page. Do not add `useAuth`, `useTimer`, or React Query for this SPA.

## Anti-patterns

- Do not derive elapsed from `entry.durationSeconds` while running — that snapshot goes stale. Use `nowMs - startedAt`.
- Do not start a second 1s interval inside `useTimerController` when `App` already provides `nowMs`.
- Do not skip the `cancelled` flag on `StatsPage` polling.
