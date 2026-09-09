# State Management

No Redux, Zustand, or context providers beyond React defaults.

## App-owned state

`App.tsx` holds:

- `user: User | null | undefined` — session (its `timezone` field feeds the App-derived `tz = user?.timezone ?? browserTz()` handed to `useTimerController` / `StatsPage` / `GoalsPage` as a prop; switching timezone in settings updates `user` via `onUserUpdated`, which changes `tz` and re-triggers the tz-dependent fetch effects — task 09-06-settings-timezone). Detect-then-persist (task 09-06-timezone-autodetect-persist): when a loaded user has `timezone === null`, App fires a one-shot fire-and-forget `updateProfile({ timezone: browserTz() })` (deduped per user id via a ref — StrictMode-safe; failure silent, retried next visit); the successful response replaces `user`, closing the transient null window. Manually set zones are never overwritten.
- `page: PageId` — shell tab
- `current: TimeEntry | null` — running timer
- `nowMs` — clock for elapsed

`setOnUnauthorized` clears `user` and `current` so a 401 on a later request returns to login.

After login/register, `AuthPage` calls `onAuthed(user)`. After logout, call `api.logout` then clear local state (logout errors are ignored).

When `user` becomes set, `App` loads `api.current()` into `current`. `useTimerController` can replace `current` via its `onCurrent` prop after start/stop and after running-entry edits (description/category/tags while running → `PATCH /api/timer/current`, task 08-30-edit-while-timing).

## Page-owned state

Each page keeps its own list/error/form state. `useTimerController` holds the Timer state (categories, tags, today/week entries, view, date, start form, error) on behalf of `App` because the TimerBar and Timeline render in different places. Do not lift today’s entries or category tables into `App` state beyond that.

`useTimerController` recomputes the visible day total from `today.dayStart` / `dayEnd` plus `nowMs` (`clipSeconds` in `format.ts`). That is display state, not a store.

It also owns a `view: "day" | "week"` state (default `"day"`, persisted in `localStorage["chronolog-view-mode"]` by task 09-08-persist-view-prefs — same try/catch rule as the date key, garbage values fall back to `"day"`) and the week data (`WeekEntries | null`). Week data loads lazily on first switch to the week view; after start/stop, refresh the week data too if it was already loaded, so switching back shows fresh entries.

It also owns a `date: string | null` view anchor (`null` = today/this week), persisted in `localStorage["chronolog-date-view"]` (try/catch, garbage values treated as null). Any date change or day↔week view switch re-fetches the target view's data for that `date` — never reuse cached week data across date changes (stale-data bug fixed in the date-switcher task). `DateNav` renders the `← [label] → [今天]` navigation; picking today from the calendar normalizes back to `null`.

## Persistence

The only persistence is the HttpOnly `sid` cookie. No JWT, no saved elapsed.

One exception: theme preference is persisted in `localStorage["chronolog-theme"]` (`"light" | "dark" | "system"`, missing = `"system"`) by `use-theme.ts`. The inline script in `index.html` applies the `.dark` class before React mounts to avoid flash; `useTheme()` in `App.tsx` owns the state and the `matchMedia` listener (registered only in `system` mode). Wrap all `localStorage` access in `try/catch` — privacy mode throws `SecurityError`.

Second exception: the timer page's viewed date is persisted in `localStorage["chronolog-date-view"]` (`"YYYY-MM-DD"` or removed = today). Same try/catch rule; invalid/garbage values fall back to null (today).

Third and fourth exceptions (task 09-08-persist-view-prefs): the timer page's view mode (`"day" | "week"`) is persisted in `localStorage["chronolog-view-mode"]` by `useTimerController`, and the timeline scale (60/30/15/5) in `localStorage["chronolog-scale"]` by `Timeline.tsx`. Same try/catch rule; garbage values fall back to the defaults (`"day"` / `60`).

Another UI-preference key follows the same pattern (task 09-08-axis-view): `localStorage["chronolog-day-subview"]` (`"block" | "entries"`, removed/invalid = `block` — day-mode subview, owned by `Timeline` local state, not `useTimerController`).

## Continuous timing (task 09-08-continuous-timing)

When the user's `continuousTiming` setting is on, `api.stop()` returns the **new running** entry (server stops the old one and starts a new uncategorized one in one transaction — see backend http-routes.md). `useTimerController.onToggle` branches on `entry.stoppedAt === null`: null → segment switched, call `props.onCurrent(newEntry)` and set `categoryPickerAutoOpen` so the CategoryPicker (controlled via its optional `open`/`onOpenChange` props) auto-opens to prompt for a category; non-null → fully stopped, `props.onCurrent(null)`. `categoryPickerAutoOpen` resets when the user picks a category / closes the dropdown, and the `running?.id` effect clears it when running disappears (e.g. the new entry was stopped from another device) — a stale `true` would force-open the start-form's picker. Do not infer the mode client-side from `user.continuousTiming` in the stop path — the server response is the source of truth.

Dev: Vite proxy keeps `/api` on the same origin as the page so `credentials: "same-origin"` sends the cookie. Production: Fastify serves both.

## Anti-patterns

- Do not keep a second copy of `user` inside pages.
- Do not use URL pathnames for tabs (there is no router; refresh always boots then shows 计时).
- Do not stop the running timer in client-only state without `api.stop()` — the server row is the source of truth.
