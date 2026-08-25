# Component Guidelines

Desktop Toggl-like shell. Visual reference: archived MVP `research/toggl-web-ui.md`. Tokens live on `:root` in `web/src/styles.css` (`--nav` dark, `--page` beige, `--card` white, `--stop` red).

## Shell

`Shell` (`web/src/components/Shell.tsx`): full-height dark left nav, beige main.

Nav items (fixed product IA):

| `PageId` | Label | Main |
|----------|--------|------|
| `timer` | 计时 | Timer bar + today’s entry list |
| `stats` | 统计 | Today’s **per-category** totals |
| `categories` | 分类 | Category table |

Footer: username + `退出`. While a timer runs, the 计时 item shows elapsed (`formatDuration`). Do not add Calendar, Timesheet, week pickers, or a marketing landing page.

Unauthenticated users see only `AuthPage` (login/register tabs). No shell.

## Timer page vs stats page

`TimerPage` may show:

- Description input, required category pill, elapsed, round play/stop
- Today’s list (description, category, clock range, clipped duration)
- A **day grand total** in the day-card header (`dayTotal`)

`TimerPage` must **not** show a per-category breakdown (bars or a “工作 / 学习 / …” sum list). That is `StatsPage` only (R15).

`StatsPage` polls `/api/stats/today` every 5s and draws category rows + bars. Empty copy: `今天还没有记录`.

## Copy and controls

- UI language is Chinese. Placeholders too (`你在做什么？`, `选择分类`).
- Buttons: `type="button"` unless they submit a form (`AuthPage`).
- Play/stop is a round button with `aria-label` 开始 / 停止.
- Category color is `categoryColor(name)` in `format.ts` (hash → palette). Do not store colors in the database.
- Occupied categories: disable delete and keep the server’s 409 message as `title` (`CategoriesPage`).

## Anti-patterns

- Do not put category totals on the timer page.
- Do not add React Router; page state is `PageId` in `App`.
- Do not stop the timer on `beforeunload` — R7 says the timer survives browser close.
- Do not introduce a component library or Tailwind for one new control; reuse classes in `styles.css`.
