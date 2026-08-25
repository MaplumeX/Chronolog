# Type Safety

`web/tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`, `moduleResolution: bundler`.

## Payload types

Define API shapes in `web/src/api.ts` beside the functions that return them. `TimeEntry` mirrors server `EntryDto` (`server/src/entries.ts`).

Instants are `string`, not `Date`. Parse only at the edge with `Date.parse` / `new Date(iso)` inside `format.ts`. Display with `toLocaleTimeString("zh-CN", { timeZone: tz, hour12: false })`.

`stoppedAt: string | null` — null means running. Optional `clippedSeconds` is present on today-list rows from the API; the timer page still recomputes clip with `nowMs` so running rows tick.

## Props

Pages use inline props objects (`TimerPage` `{ nowMs, current, onCurrent }`). No `React.FC`. Event handlers that return promises are wrapped with `void` at the JSX boundary (`void logout()`, `void refresh()`).

## Anti-patterns

- Do not treat ISO-Z strings as naive local time (`new Date("2026-08-25T16:00:00.000Z")` without `timeZone` in the formatter).
- Do not `as` whole API responses in pages; `request<T>` already casts once at the client boundary.
- Do not import server modules from `web/`.
