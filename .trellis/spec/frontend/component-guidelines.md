# Component Guidelines

Light product shell, Tailwind v4 + shadcn/ui (new-york, neutral). No elevated white cards as page chrome. Visual grouping is spacing, `border-b`, and surface color.

Tokens live on `:root` in `web/src/styles.css` (shadcn CSS variables). Light only: do not add a `.dark` theme or `prefers-color-scheme` invert.

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
| `stats` | 统计 | Today’s **per-category** totals + tag filter |
| `categories` | 分类 | Category table |
| `tags` | 标签 | Tag table (create / rename / delete) |

Footer: username + language switcher (`LanguageSwitcher`, shadcn `DropdownMenu` with 中文 / English) + `退出`. While a timer runs, the 计时 item shows elapsed (`formatDuration`) via `SidebarMenuBadge`. Do not add Calendar, Timesheet, week pickers, or a marketing landing page.

Screen-reader copy on Sidebar/Sheet is i18n-ized (`sidebar.nav`, `sidebar.toggle`, `sidebar.close` keys).

## Pages

`AuthPage`: centered `max-w-sm` form, `Tabs` for 登录/注册. No card shadow wrapper.

Timer orchestration lives in the `useTimerController` hook (see [Hook Guidelines](./hook-guidelines.md)) — there is no `TimerPage`. Markup lives in:

- `TimerBar` — rendered inside the Shell top bar (Toggl "What are you working on?" style): `text-lg` input filling the row, `rounded-lg` outlined pickers, mono `text-xl` elapsed, round solid play/stop (`aria-label` 开始 / 停止). No outer `border-b` (the header has one). Stacks vertically below `md`.
- `CategoryPicker` — shadcn `DropdownMenu`.
- `Timeline` — 0:00–24:00 ruler; one colored block per entry; running entry grows with `nowMs`; now-line; full/compact/mini tiers; day grand total in the header. Scale density is switchable: `SCALES = [60, 30, 15, 5]` minutes (default 60), toggled by −/+ buttons next to the day/week Tabs (boundary buttons disabled). Geometry contract: each tick is a fixed 40px tall (`PX_PER_TICK`), so the timeline height is `(1440 / scale) × 40px` (60→960px, 5→11520px) set as an inline style on `.timeline-inner` — do NOT restore a fixed height in CSS. All tick labels render (HH:MM, 12px). Block tier thresholds are pixel-based (≥24px full / ≥10px compact / else mini), not percent-based, so they stay correct across scales. Scroll-anchoring re-runs when `scale` changes. i18n keys: `timeline.zoomIn` (+) / `timeline.zoomOut` (−), with no visible scale label between the buttons. Supports `mode: "day" | "week"`: day renders one column (today), week renders 7 side-by-side day columns (Mon–Sun, horizontal scroll) with a week-range header, per-day column headers (bold day number + weekday + day total, today's header highlighted with `bg-primary/10` + `text-primary`), and the now-line only in today's column. Single-day rendering is shared via an internal `DayColumn` component (`showRuler?: boolean` — week mode renders one shared ruler on the left and passes `showRuler={false}` so hour labels appear once and grid lines span all days; empty days show no hint in week mode). Stopped blocks are clickable and open an edit popover (`EntryEditor`); running blocks have no `onClick`. The popover is anchored to the block via `Popover.Anchor` (Root lives at `Timeline` top level, Anchor inside `DayColumn`); `EntryEditor` gets `key={entry.id}` so switching entries remounts the form.

The timer page must **not** show a per-category breakdown. That is `StatsPage` only (R15).

`TagPicker` — shadcn `DropdownMenu` multi-select; checked items show a `Check` icon and `bg-accent`. `TimerBar` renders it as a slot; while running, read-only tag badges replace the picker.

`Timeline` full tier shows a tag badge row (dot + name, `categoryColor(tag.name)`) under `block-meta`; compact/mini tiers skip badges, tooltip title appends tag names.

`EntryEditor` (popover content): description / category / tags / start+end time (`datetime-local step=1` to keep seconds) / live duration / save / cancel. Time conversion is browser-local (`new Date(value).toISOString()`), matching `TimerBar`. Save calls `api.updateEntry` then refreshes today+week only (never resets the start-timer form) and closes the popover; 409 `OVERLAP` shows `entry.overlap` copy.

## CSS Cascade Layers gotcha

Un-layered CSS beats Tailwind v4 `@layer utilities` classes regardless of source order. Do not set `cursor: default` on a base class that also gets `cursor-pointer` from a utility — the base wins and the pointer never shows. Scope the base rule to the non-interactive state instead (e.g. `.timeline-block.running { cursor: default }`).

`StatsPage` polls `/api/stats/today` every 5s. A total-logged summary card sits at the top (`stats.totalLogged` label, `text-3xl font-bold tabular-nums` value, `rounded-lg border`, value = sum of `stats.categories` seconds). Rows + category-colored bars (not shadcn `Progress`). Optional tag filter dropdown (全部标签 + each tag) re-requests with `tagId`.

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
