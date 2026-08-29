# Component Guidelines

Light product shell, Tailwind v4 + shadcn/ui (new-york). No elevated white cards as page chrome. Visual grouping is spacing, `border-b`, and surface color.

Tokens live on `:root` and `.dark` in `web/src/styles.css` (shadcn CSS variables, teal cool-theme, both light and dark maintained — see [Design Tokens](./design-tokens.md)). Theme switching is handled by `ThemeSwitcher` + the `use-theme` hook; do not hardcode raw colors in components.

## Shell

`Shell` (`web/src/components/Shell.tsx`): `SidebarProvider` + `Sidebar collapsible="icon"` + `SidebarInset`.

- Top bar (`min-h-12`, `border-b`): `[SidebarTrigger][header]`. `Shell` accepts a `header?: ReactNode` prop; `App` is the sole assembler — non-timer pages pass a page-level `<h1>` (`text-lg font-semibold`, `nav.*` i18n key) and the pages themselves have no `<h1>`; the timer page passes `<TimerBar {...timer.barProps} />` (Toggl-style: the timer bar lives in the top bar). The sidebar nav group carries a `SidebarGroupLabel` (`nav.group` key, uppercase tracking-wide).
- Desktop: expand to labels, collapse to icon rail. `SidebarTrigger` in the inset header only (not a second nav).
- Narrow (`<768px`): same items in the Sidebar Sheet drawer. Opening a page closes the drawer (`setOpenMobile(false)`).
- Variant is default `sidebar`, not `floating` / `inset` (those look like cards).
- Unauthenticated users see only `AuthPage`. No shell.

Nav items (fixed product IA):

| `PageId` | Label | Main |
|----------|--------|------|
| `timer` | 计时 | Timer bar (in the Shell top bar via `header`) + today’s entry timeline |
| `stats` | 统计 | Range stats (today/week/month/custom) — trend chart + category share + tag breakdown (task 08-29-refactor-stats-page) |
| `categories` | 分类 | Category table |
| `tags` | 标签 | Tag table (create / rename / delete) |
| `settings` | 设置 | Tabbed settings — 通用 / 账户 / API Tokens (task 08-29-tabbed-settings) |

Footer: two items — a non-interactive user display (`displayName ?? username`, `pointer-events-none` + `tabIndex={-1}`, first-letter avatar in icon mode) and a separate `Settings`-icon entry (lucide `Settings` + `nav.settings`, clickable → settings page, closes the mobile drawer). Language switcher, theme switcher, logout, and API tokens live in the tabbed settings page — do not re-add them to the sidebar. While a timer runs, the 计时 item shows elapsed (`formatDuration`) via `SidebarMenuBadge`. Do not add Calendar, Timesheet, week pickers, or a marketing landing page.

Screen-reader copy on Sidebar/Sheet is i18n-ized (`sidebar.nav`, `sidebar.toggle`, `sidebar.close` keys).

## Pages

`AuthPage`: centered `max-w-sm` form, `Tabs` for 登录/注册. No card shadow wrapper. Loads `GET /api/meta` on mount (failure = treat as open); when `registrationOpen` is false the 注册 tab is disabled with `auth.registrationClosed` copy.

`SettingsPage` (task 08-29-tabbed-settings): shadcn `Tabs` with three tabs — 通用 (language via `LanguageSwitcher` + theme via `ThemeSwitcher`, one `Label`-annotated row each), 账户 (profile / change password / logout / danger zone), API Tokens (embeds `TokensPage`). Tab state is SettingsPage-local; default tab is 账户. `TabsList` keeps `max-w-md` only — no `overflow-x-auto` (it renders a permanent scrollbar on desktop; the three short tabs never overflow). 账户 tab content: profile (username + displayName, save disabled until something changed), change password (3 password inputs, submit blocked on mismatch), logout button, danger zone (delete account via shadcn `Dialog` password confirmation). Props `{ user, onUserUpdated, onLoggedOut, themeMode, onThemeMode, onLogout }`; after `DELETE /api/account` succeeds, `App` just clears local state (server already cleared the cookie — calling `api.logout` would 401). No `<h1>`; page title renders through the Shell `header` like other non-timer pages. `LanguageSwitcher`/`ThemeSwitcher` render plain `Button` triggers with `DropdownMenu` — they must not depend on sidebar primitives.

Timer orchestration lives in the `useTimerController` hook (see [Hook Guidelines](./hook-guidelines.md)) — there is no `TimerPage`. Markup lives in:

- `TimerBar` — rendered inside the Shell top bar (Toggl "What are you working on?" style): `text-lg` input filling the row, `rounded-lg` outlined pickers, mono `text-xl` elapsed, round solid play/stop (`aria-label` 开始 / 停止). No outer `border-b` (the header has one). Stacks vertically below `md`.
- `CategoryPicker` — shadcn `DropdownMenu`.
- `Timeline` — 0:00–24:00 ruler; one colored block per entry; running entry grows with `nowMs`; now-line; full/compact/mini tiers; day grand total in the header. Scale density is switchable: `SCALES = [60, 30, 15, 5]` minutes (default 60), toggled by −/+ buttons next to the day/week Tabs (boundary buttons disabled). Geometry contract: each tick is a fixed 40px tall (`PX_PER_TICK`), so the timeline height is `(1440 / scale) × 40px` (60→960px, 5→11520px) set as an inline style on `.timeline-inner` — do NOT restore a fixed height in CSS. All tick labels render (HH:MM, 12px). Block tier thresholds are pixel-based (≥24px full / ≥10px compact / else mini), not percent-based, so they stay correct across scales. Scroll-anchoring re-runs when `scale` changes. i18n keys: `timeline.zoomIn` (+) / `timeline.zoomOut` (−), with no visible scale label between the buttons. Supports `mode: "day" | "week"`: day renders one column (today), week renders 7 side-by-side day columns (Mon–Sun, horizontal scroll) with a week-range header, per-day column headers (bold day number + weekday + day total, today's header highlighted with `bg-primary/10` + `text-primary`), and the now-line only in today's column. Single-day rendering is shared via an internal `DayColumn` component (`showRuler?: boolean` — week mode renders one shared ruler on the left and passes `showRuler={false}` so hour labels appear once and grid lines span all days; empty days show no hint in week mode). Stopped blocks are clickable and open an edit popover (`EntryEditor`); running blocks have no `onClick`. The popover is anchored to the block via `Popover.Anchor` (Root lives at `Timeline` top level, Anchor inside `DayColumn`); `EntryEditor` gets `key={entry.id}` so switching entries remounts the form. Drag-to-create on empty track space (task 08-27-timeline-drag-create): `DayColumn` takes optional `onDragCreate({ startedAt, stoppedAt })`; when absent, no pointer handlers attach and behavior is unchanged. pointerdown on the track ignores presses that hit `.timeline-block` (`closest()` check) so block click-edit is unaffected; `setPointerCapture` + pointermove render a `.timeline-block.drag-preview` (semi-transparent, `HH:MM – HH:MM` via `formatClock`, `pointer-events: none`) and pointerup with no snap movement cancels (plain click never creates). Snap map `{60: 15, 30: 10, 15: 5, 5: 1}` minutes (`Math.round`), and equal snapped start/end becomes one grid step (min-duration rule). Draft state lives in `Timeline` as `{ dayStart, startedAt, stoppedAt }` — week mode passes the dragged column's `dayStart` so the entry lands on that day — and opens the same Popover with `EntryEditor` in draft mode; save calls `api.createEntry` then refreshes, cancel/close/`pointercancel` discard the draft. Also handle `onPointerCancel` to avoid a stale preview when the OS interrupts the drag.

The timer page must **not** show a per-category breakdown. That is `StatsPage` only (R15).

`TagPicker` — shadcn `DropdownMenu` multi-select; checked items show a `Check` icon and `bg-accent`. `TimerBar` renders it as a slot; while running, read-only tag badges replace the picker.

`Timeline` full tier shows a tag badge row (dot + name, `categoryColor(tag.name)`) under `block-meta`; compact/mini tiers skip badges, tooltip title appends tag names.

`EntryEditor` (popover content): description / category / tags / start+end time (`datetime-local step=1` to keep seconds) / live duration / save / cancel. Time conversion is browser-local (`new Date(value).toISOString()`), matching `TimerBar`. Props are either `entry: TimeEntry` (edit, calls `api.updateEntry`) or `draft: { startedAt, stoppedAt }` (create, calls `api.createEntry`, empty title `entry.create`, categoryId starts `""` and the save button is disabled until a category is picked). Refresh today+week only (never resets the start-timer form) and close the popover; 409 `OVERLAP` shows `entry.overlap` copy in both modes.

## CSS Cascade Layers gotcha

Un-layered CSS beats Tailwind v4 `@layer utilities` classes regardless of source order. Do not set `cursor: default` on a base class that also gets `cursor-pointer` from a utility — the base wins and the pointer never shows. Scope the base rule to the non-interactive state instead (e.g. `.timeline-block.running { cursor: default }`).

`StatsPage` (task 08-29-refactor-stats-page) is range-driven, not today-only. State: `{ kind: "today" | "week" | "custom" | "month", customFrom, customTo }` + `tagId` filter. All range presets (today/week/month) derive `from`/`to` client-side from `browserTz()` local dates (`todayIn(tz)` via `Intl.DateTimeFormat("en-CA", { timeZone })` — never `toISOString().slice(0, 10)`; week/month arithmetic happens on pure calendar labels via UTC-midnight `Date` objects, same手法 as `DateNav.tsx`) and call `api.statsRange(tz, from, to, tagId)`. Custom range uses a `Popover` + `react-day-picker` `mode="range"`; incomplete / `from > to` / >92-day ranges show a destructive hint and skip the request. Polling: only the `today` preset polls (5s); historical presets fetch once per parameter change. Cross-midnight roll: `todayIn(tz)` is cached in state (`todayKey`) and re-checked on each poll tick — updating it recomputes the query so a page left open past midnight rolls to the new day.

Layout (top → bottom): range `Tabs` + tag filter dropdown → total-logged summary card (`stats.totalLogged`, `text-3xl font-bold tabular-nums`, plain `rounded-lg border` div) → daily-trend recharts `BarChart` (`ResponsiveContainer`, fixed `h-56`, bar fill `var(--primary)`, tooltip `formatDuration`) → category share as a recharts donut `PieChart` (innerRadius, `Cell` fill `categoryColor(name)`, center total) plus the horizontal bar list with a percentage column → tag breakdown as pure-CSS bars (`tagId === null` renders `stats.noTag` with muted color; do NOT show a tags total — multi-tag entries count fully under each tag, so the sum can exceed `totalSeconds`). Empty state (`totalSeconds === 0`) shows `stats.emptyRange` guidance copy. Charts must take colors from CSS variables / `categoryColor` only (dual-theme safe). `recharts` is the only chart library allowed; the >500 kB bundle warning from it is accepted (code-splitting is out of scope).

`TagsPage`: shadcn `Table` like `CategoriesPage`; delete uses an inline two-click confirm (删除 → 确认删除？), no alert-dialog component.

`CategoriesPage`: shadcn `Table`. Occupied categories: disable delete; keep the 409 explanation as `title`.

Do not `shadcn add card` to wrap these pages.

## Copy and controls

- UI copy is i18n-ized: all strings come from `t()` keys in `web/src/i18n/locales/` (zh default, en). Placeholders too (`timer.placeholder`, `timer.selectCategory`). Never hardcode UI copy in components.
- Buttons: `type="button"` unless they submit a form (`AuthPage`).
- Icons: Lucide only (`Timer`, `ChartNoAxesColumn`, `Tags`, `Tag`, `LogOut`, `Play`, `Square`).
- Category color is `categoryColor(name)` in `format.ts` (hash → palette). Do not store colors in the database.

## Anti-patterns

- Do not put category totals on the timer page.
- Do not add React Router; page state is `PageId` in `App`.
- Do not stop the timer on `beforeunload` — R7 says the timer survives browser close.
- Do not wrap pages in shadcn `Card` or revive `auth-card` / `timeline-card` / `stats-card` / `table-card` (the StatsPage summary card is a plain `rounded-lg border` div, not a shadcn `Card`).
- Do not add a page-level `<h1>` — page titles render in the Shell top bar via the `header` prop.
- Do not mix another icon set or CSS framework on top of Tailwind + shadcn.
- Do not invent a bottom tab bar; mobile uses the sidebar drawer.
