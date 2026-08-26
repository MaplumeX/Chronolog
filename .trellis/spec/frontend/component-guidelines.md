# Component Guidelines

Light product shell, Tailwind v4 + shadcn/ui (new-york, neutral). No elevated white cards as page chrome. Visual grouping is spacing, `border-b`, and surface color.

Tokens live on `:root` in `web/src/styles.css` (shadcn CSS variables). Light only: do not add a `.dark` theme or `prefers-color-scheme` invert.

## Shell

`Shell` (`web/src/components/Shell.tsx`): `SidebarProvider` + `Sidebar collapsible="icon"` + `SidebarInset`.

- Desktop: expand to labels, collapse to icon rail. `SidebarTrigger` in the inset header only (not a second nav).
- Narrow (`<768px`): same items in the Sidebar Sheet drawer. Opening a page closes the drawer (`setOpenMobile(false)`).
- Variant is default `sidebar`, not `floating` / `inset` (those look like cards).
- Unauthenticated users see only `AuthPage`. No shell.

Nav items (fixed product IA):

| `PageId` | Label | Main |
|----------|--------|------|
| `timer` | 计时 | Timer bar + today’s entry timeline |
| `stats` | 统计 | Today’s **per-category** totals + tag filter |
| `categories` | 分类 | Category table |
| `tags` | 标签 | Tag table (create / rename / delete) |

Footer: username + language switcher (`LanguageSwitcher`, shadcn `DropdownMenu` with 中文 / English) + `退出`. While a timer runs, the 计时 item shows elapsed (`formatDuration`) via `SidebarMenuBadge`. Do not add Calendar, Timesheet, week pickers, or a marketing landing page.

Screen-reader copy on Sidebar/Sheet is i18n-ized (`sidebar.nav`, `sidebar.toggle`, `sidebar.close` keys).

## Pages

`AuthPage`: centered `max-w-sm` form, `Tabs` for 登录/注册. No card shadow wrapper.

`TimerPage` orchestrates only. Markup lives in:

- `TimerBar` — description, category picker slot, elapsed, round play/stop (`aria-label` 开始 / 停止). Stacks vertically below `md`.
- `CategoryPicker` — shadcn `DropdownMenu`.
- `Timeline` — 0:00–24:00 ruler; one colored block per entry; running entry grows with `nowMs`; now-line; full/compact/mini tiers; day grand total in the header. Supports `mode: "day" | "week"`: day renders one column (today), week renders 7 side-by-side day columns (Mon–Sun, horizontal scroll) with a week-range header, per-day column headers (bold day number + weekday + day total, today's header highlighted with `bg-primary/10` + `text-primary`), and the now-line only in today's column. Single-day rendering is shared via an internal `DayColumn` component (`showRuler?: boolean` — week mode renders one shared ruler on the left and passes `showRuler={false}` so hour labels appear once and grid lines span all days; empty days show no hint in week mode).

`TimerPage` must **not** show a per-category breakdown. That is `StatsPage` only (R15).

`TagPicker` — shadcn `DropdownMenu` multi-select; checked items show a `Check` icon and `bg-accent`. `TimerBar` renders it as a slot; while running, read-only tag badges replace the picker.

`Timeline` full tier shows a tag badge row (dot + name, `categoryColor(tag.name)`) under `block-meta`; compact/mini tiers skip badges, tooltip title appends tag names.

`StatsPage` polls `/api/stats/today` every 5s. Rows + category-colored bars (not shadcn `Progress`). Empty copy: `今天还没有记录`. Optional tag filter dropdown (全部标签 + each tag) re-requests with `tagId`.

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
- Do not wrap pages in shadcn `Card` or revive `auth-card` / `timeline-card` / `stats-card` / `table-card`.
- Do not mix another icon set or CSS framework on top of Tailwind + shadcn.
- Do not invent a bottom tab bar; mobile uses the sidebar drawer.
