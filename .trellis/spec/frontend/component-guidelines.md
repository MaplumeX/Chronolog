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
| `stats` | 统计 | Today’s **per-category** totals |
| `categories` | 分类 | Category table |

Footer: username + `退出`. While a timer runs, the 计时 item shows elapsed (`formatDuration`) via `SidebarMenuBadge`. Do not add Calendar, Timesheet, week pickers, or a marketing landing page.

Screen-reader copy on Sidebar/Sheet is Chinese (`切换侧栏`, `导航`, `关闭`).

## Pages

`AuthPage`: centered `max-w-sm` form, `Tabs` for 登录/注册. No card shadow wrapper.

`TimerPage` orchestrates only. Markup lives in:

- `TimerBar` — description, category picker slot, elapsed, round play/stop (`aria-label` 开始 / 停止). Stacks vertically below `md`.
- `CategoryPicker` — shadcn `DropdownMenu`.
- `Timeline` — 0:00–24:00 ruler; one colored block per entry; running entry grows with `nowMs`; now-line; full/compact/mini tiers; day grand total in the header.

`TimerPage` must **not** show a per-category breakdown. That is `StatsPage` only (R15).

`StatsPage` polls `/api/stats/today` every 5s. Rows + category-colored bars (not shadcn `Progress`). Empty copy: `今天还没有记录`.

`CategoriesPage`: shadcn `Table`. Occupied categories: disable delete; keep the 409 explanation as `title`.

Do not `shadcn add card` to wrap these pages.

## Copy and controls

- UI language is Chinese. Placeholders too (`你在做什么？`, `选择分类`).
- Buttons: `type="button"` unless they submit a form (`AuthPage`).
- Icons: Lucide only (`Timer`, `ChartNoAxesColumn`, `Tags`, `LogOut`, `Play`, `Square`).
- Category color is `categoryColor(name)` in `format.ts` (hash → palette). Do not store colors in the database.

## Anti-patterns

- Do not put category totals on the timer page.
- Do not add React Router; page state is `PageId` in `App`.
- Do not stop the timer on `beforeunload` — R7 says the timer survives browser close.
- Do not wrap pages in shadcn `Card` or revive `auth-card` / `timeline-card` / `stats-card` / `table-card`.
- Do not mix another icon set or CSS framework on top of Tailwind + shadcn.
- Do not invent a bottom tab bar; mobile uses the sidebar drawer.
