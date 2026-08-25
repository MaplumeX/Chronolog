# Research: toggl-timer-ux

- Query: Toggl Track-like timer UX constraints for Chronolog MVP (start/stop placement, one running timer, start-while-running, tab close, today list grouping). Not projects/tags, calendar, manual backfill, or week reports.
- Scope: mixed
- Date: 2026-08-25

## Recommendation

Copy Toggl’s **Timer page List view**, not Calendar / Timesheet / Manual mode.

1. **Sticky top bar:** category (required) + optional description + elapsed + one Start/Stop control on the right.
2. **One running entry per user**, stored on the server (`stopped_at` null). Closing the tab does not stop it.
3. **Start while running = stop the old one at now, then start the new one** in one request. Never two running rows (PRD R3 / AC3).
4. **Today list** under the bar: date header + day total, then individual entries with category, description, start–stop, duration. Do not group similar entries.
5. Running timer lives in the top bar; do not also treat it as a finished list row.

Out of scope (do not build even if Toggl has them): projects, tags, calendar, timesheet, manual duration entry, continue/play-on-row, week sidebar, Pomodoro, browser extension.

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/08-25-chronolog-mvp/prd.md` | R1–R5, R3 one timer, AC3 no two running, R5 no fill-the-day |
| Repo | No UI code yet |

### Start/stop placement

Toggl Timer page is three zones: **top time-entry bar**, **list/calendar/timesheet**, **optional stats sidebar**.

The bar is always visible. Idle: pink **Play** (keyboard `N`). Running: elapsed ticks, control becomes red **Stop** (`S`). Details (in Toggl: description/project/tags) can be filled before or after start.

Chronolog mapping:

- Replace Toggl’s optional project with a **required category** (R1 / AC1). Start is disabled until a category is selected.
- Description optional.
- Put Start/Stop on the **right of the bar**, elapsed next to it — same visual grammar as Toggl so “Toggl 式” is recognizable.

Sources: [The Timer Page](https://support.toggl.com/the-timer-page), [Timer Mode](https://support.toggl.com/timer-mode), [Creating a Time Entry](https://support.toggl.com/en-us/article/creating-a-time-entry-fcnxd6).

### One running timer

Toggl exposes a single “current” entry: `GET /api/v9/me/time_entries/current`. Running rows use `stop: null` and a negative `duration`. There is **no pause**; “continue” starts a *new* entry with the same details.

Chronolog: enforce in the database, not only in the UI.

```sql
CREATE UNIQUE INDEX time_entries_one_running
  ON time_entries(user_id)
  WHERE stopped_at IS NULL;
```

Sources: [Toggl tracking docs](https://engineering.toggl.com/docs/tracking/), [v8 time entries (archived)](https://github.com/toggl/toggl_api_docs/blob/master/chapters/time_entries.md), [Does Toggl have a pause feature?](https://support.toggl.com/en-us/article/does-toggl-have-a-pause-feature-14v5mtu).

### Start while one is already running

Toggl web/apps treat Start / Continue as a **switch**: the previous running entry is stopped, a new one starts. Auto-tracker docs say the same (“previous timer stops and the new one begins”). The product never presents two live timers.

Two implementations both satisfy AC3:

| Policy | UX | Pick? |
|---|---|---|
| **Stop-then-start** (Toggl) | One click to switch category | **Yes** |
| 409 reject | User must Stop then Start | No — extra click, not Toggl-like |

Do it **server-side in one transaction**: stop current (`stopped_at = now`, duration computed), insert new running row. If two tabs race, the unique index rejects the second writer; retry as stop-then-start.

Do not silently discard the previous interval.

### Tab close / refresh

Default Toggl behavior: the running entry is **server-side**. Close the browser, reopen later, it is still running. The official extension has an *opt-in* “Stop timer automatically when the browser is closed” — default is off, and it does not fire on force-quit.

Chronolog: **no stop-on-unload**. `beforeunload` is unreliable and would violate “timer continues if the tab is closed.” Elapsed in the UI = `now - started_at` (UTC). On load, `GET /api/timer/current` (or equivalent) restores the bar.

Sources: [Browser extension — start/stop settings](https://support.toggl.com/toggl-track-browser-extension), [GitHub #1735 stop-on-close](https://github.com/toggl/track-extension/issues/1735).

### Today list grouping

Toggl List view:

- Rows grouped by **calendar date** (Today / Yesterday / date).
- Each date header shows a **day total**.
- Optional “Group similar time entries” (same description+project+tags) — Profile setting, off or on per user.

iOS list: chronological entries with **time entry totals for each date**.

Chronolog MVP:

- One section: **Today** (user timezone — see `today-timezone.md`).
- Header: label + **today total** (and, if in scope, per-category totals).
- Rows: one row per stopped entry that overlaps today; show category, optional description, local start–stop, duration.
- Running time: show in the top bar; optionally add its *today-clipped* elapsed into the header total, not as a second “open” row.
- Do **not** collapse similar rows. Lyubishchev totals are by **category**, not by description.

Sources: [Tracking time in List-view](https://support.toggl.com/en-us/article/tracking-time-in-list-view-btbuu1), [iOS Timer list](https://support.toggl.com/toggl-track-timer-for-ios).

### Explicitly not Toggl

| Toggl feature | Why skip |
|---|---|
| Projects / tags | PRD: category is the only dimension |
| Calendar / Timesheet | Out of dispatch; calendar is gap-filling adjacent to R5 |
| Manual mode / duration field | No backfill in this research scope |
| Continue play on a past row | Nice later; not needed to pass AC1–AC3 |
| Week totals / Goals sidebar | Week reports out of scope |

R5 / AC4: empty hours are just empty. No “complete the day” affordance.

## Caveats / Not Found

- Current Toggl v9 `POST .../time_entries` does not document “must stop current first.” Unofficial API clients sometimes create a second running row. **Chronolog must enforce uniqueness itself**, not copy the API loophole.
- Exact web-app behavior of Play while running is described by product usage and auto-tracker docs, not a single “switch timer” support article.
- Toggl date grouping uses the user’s profile timezone; Chronolog should do the same (see `today-timezone.md`).
