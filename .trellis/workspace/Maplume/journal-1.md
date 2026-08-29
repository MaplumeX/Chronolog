# Journal - Maplume (Part 1)

> AI development session journal
> Started: 2026-08-25

---



## Session 1: Chronolog MVP: Toggl-style Docker time tracker

**Date**: 2026-08-26
**Task**: Chronolog MVP: Toggl-style Docker time tracker
**Branch**: `main`

### Summary

Planned and shipped Chronolog MVP: Docker self-hosted Fastify+React+SQLite tracker with open registration, required categories, timer page plus stats page, Toggl-like desktop shell. Tests and compose smoke passed. Specs filled from the new codebase.

### Git Commits

| Hash | Message |
|------|---------|
| `d3de0a8` | (see git log) |
| `b20fb13` | (see git log) |

### Status

[OK] **Completed**


## Session 2: Refresh Trellis specs from Chronolog codebase

**Date**: 2026-08-26
**Task**: Refresh Trellis specs from Chronolog codebase
**Branch**: `main`

### Summary

Rewrote .trellis/spec from server/ and web/ source: added auth, timezone, HTTP routes, API client, and Docker ops guides; fixed 401 code to UNAUTHORIZED; stripped Trellis template leftover from thinking guides.

### Git Commits

| Hash | Message |
|------|---------|
| `30709a5` | (see git log) |

### Status

[OK] **Completed**


## Session 3: 计时界面时间线改造

**Date**: 2026-08-26
**Task**: 计时界面时间线改造
**Branch**: `feat/timer-timeline-ui`

### Summary

将 TimerPage 当日记录从逐行列表改为纵向时间线视图：0:00-24:00 时间轴、按起止时间定位的彩色时间块、运行中条目实时增长、当前时间指示线、块内分档显示。更新 frontend spec。参考 Toggl Calendar view 设计。

### Git Commits

| Hash | Message |
|------|---------|
| `253382e` | (see git log) |

### Status

[OK] **Completed**


## Session 4: Restructure components and layout

**Date**: 2026-08-26
**Task**: Restructure components and layout
**Branch**: `feat/restructure-components-layout`

### Summary

Replaced Chronolog beige card chrome with Tailwind v4 + shadcn: light neutral shell, collapsible icon sidebar, mobile drawer, extracted TimerBar/CategoryPicker/Timeline. Frontend specs updated. No API/behavior change.

### Git Commits

| Hash | Message |
|------|---------|
| `0733e27` | (see git log) |
| `b3969f4` | (see git log) |

### Status

[OK] **Completed**


## Session 5: 前端 i18n 国际化支持

**Date**: 2026-08-26
**Task**: 前端 i18n 国际化支持
**Branch**: `feat/i18n-support`

### Summary

为 web/ 前端引入 i18next + react-i18next：新增 web/src/i18n/（zh/en 语言资源、初始化、LanguageSwitcher），全部 UI 文案改为 t() key，format.ts locale 随语言切换，localStorage 持久化（chronolog.lang），首次默认中文；更新 frontend spec 的 UI 语言约束
## Session 5: 夜间模式：明/暗/跟随系统三态切换

**Date**: 2026-08-26
**Task**: 夜间模式：明/暗/跟随系统三态切换
**Branch**: `feat/night-mode`

### Summary

为 Chronolog 前端添加夜间模式：.dark 变量集（shadcn 标准 oklch）、useTheme hook（localStorage 持久化 + system 模式 matchMedia 监听）、index.html 内联防闪烁脚本、Sidebar 底部三态 dropdown 切换入口、分类色块 WCAG 对比度文字（contrastText）。check 阶段修复对比度公式分母 bug、localStorage 隐私模式异常保护、折叠侧栏 label 溢出。spec 更新：state-management 与 hook-guidelines 记录主题持久化约定。

### Git Commits

| Hash | Message |
|------|---------|
| `879a200` | (see git log) |
| `252d6f3` | (see git log) |
| `1355f75` | (see git log) |
| `3c839ab` | (see git log) |

### Status

[OK] **Completed**


## Session 6: 计时页当天/本周视图切换

**Date**: 2026-08-26
**Task**: 计时页当天/本周视图切换
**Branch**: `feat/timer-timeline-view-toggle`

### Summary

计时页时间线支持当天/本周视图切换：后端新增 GET /api/entries/week?tz= 返回 ISO 周 7 天数据（weekBounds/weekDayBounds，DST 安全）；前端 Timeline 抽 DayColumn 复用单日渲染，week 模式 7 列并排 + 周头部 + 列头，TimerPage 加 shadcn Tabs 切换与按需加载；i18n zh/en 同步；新增 week.test.ts 6 个用例（含 DST 边界），23/23 测试通过。
## Session 6: 标签功能：多标签支持（计时器输入/时间线展示/统计筛选/标签管理）

**Date**: 2026-08-26
**Task**: 标签功能：多标签支持（计时器输入/时间线展示/统计筛选/标签管理）
**Branch**: `feat/tag-feature`

### Summary

实现多标签（多对多）功能：tags/entry_tags 表（级联删除）、标签 CRUD API、timer start 接受 tagIds、EntryDto 返回 tags、stats 按 tagId 筛选；前端 TagPicker 多选、时间线标签徽章、统计页标签筛选、TagsPage 管理页、zh/en i18n；23 测试全绿，typecheck/build 通过，spec 已更新。

### Git Commits

| Hash | Message |
|------|---------|
| `0f9bb7f` | (see git log) |
| `baf6833` | (see git log) |
| `fbc4215` | (see git log) |

### Status

[OK] **Completed**


## Session 7: Polish week view: day-number headers, today highlight, shared ruler

**Date**: 2026-08-26
**Task**: Polish week view: day-number headers, today highlight, shared ruler
**Branch**: `feat/timer-timeline-view-toggle`

### Summary

Week view column headers now show a bold day number + weekday with today highlighted (bg-primary/10 + text-primary); empty days no longer show a hint; the hour ruler renders once on the left with grid lines spanning all 7 days via DayColumn showRuler=false. Day mode unchanged. Build + typecheck pass.

### Git Commits

| Hash | Message |
|------|---------|
| `c02b83e` | (see git log) |

### Status

[OK] **Completed**


## Session 8: Week view border cleanup + ruler height fix

**Date**: 2026-08-26
**Task**: Week view border cleanup + ruler height fix
**Branch**: `feat/timer-timeline-view-toggle`

### Summary

Fixed week view ruler collapse (height:auto override so flex stretch fills 960px) and removed redundant border-l on first header column that crossed the header border-b under the title. Verified with headless Chrome measurements and npm run build.

### Git Commits

| Hash | Message |
|------|---------|
| `4a28fc0` | (see git log) |
| `31f7a5f` | (see git log) |
| `cb7c29a` | (see git log) |

### Status

[OK] **Completed**


## Session 10: Merge main (tag feature #5) into timeline view toggle branch

**Date**: 2026-08-26
**Task**: Merge main (tag feature #5) into timeline view toggle branch
**Branch**: `feat/timer-timeline-view-toggle`

### Summary

Resolved 6-file merge conflict with origin/main: kept refactored DayColumn + week view structure, ported tag display into Timeline blocks (title + full-tier block-tags), listWeek now attaches tags, api.ts keeps weekEntries + todayStats tagId filter. All 29 server tests pass, web build passes.

### Git Commits

| Hash | Message |
|------|---------|
| `3e7f522` | (see git log) |

### Status

[OK] **Completed**


## Session 11: 时间线条目可点击编辑（popover）

**Date**: 2026-08-26
**Task**: 时间线条目可点击编辑（popover）
**Branch**: `feat/clickable-entries-editable-popup`

### Summary

新增 PATCH /api/entries/:id 编辑接口（本人校验/运行中409/时间校验400/重叠409 OVERLAP）；前端时间线色块可点击，popover 显示并编辑描述/分类/标签/起止时间（Radix Popover+Anchor 锚定）；check 修复 cursor 级联与表单状态残留；更新 backend/frontend spec

### Git Commits

| Hash | Message |
|------|---------|
| `6703408` | (see git log) |
| `d615c63` | (see git log) |
| `9a8b831` | (see git log) |

### Status

[OK] **Completed**


## Session 12: Toggl-style date switcher for timer timeline

**Date**: 2026-08-27
**Task**: Toggl-style date switcher for timer timeline
**Branch**: `feat/date-switcher`

### Summary

Added Toggl-style date navigation to the timer timeline: backend /api/entries/today and /week accept optional date=YYYY-MM-DD anchor (tz-interpreted, DST-safe shared bounds helpers, 400 VALIDATION on bad dates); frontend DateNav ([<-] label [->] Today) with react-day-picker calendar popover, date persisted in chronolog-date-view, day<->week switch re-fetches same date; timer bar unaffected; zh/en i18n. Spec updated: time-and-timezone.md (date anchor contract), state-management.md (date state + persistence). All typecheck/tests/build pass; 4 new server tests.
## Session 12: Timeline tick density switcher (60/30/15/5)

**Date**: 2026-08-27
**Task**: Timeline tick density switcher (60/30/15/5)
**Branch**: `feat/timeline-scale-switch`

### Summary

Added scale density switching to the timeline: 60/30/15/5-minute ticks via -/+ buttons, fixed 40px per tick with timeline height scaling to (1440/scale)*40px, all labels shown, pixel-based block tier thresholds, scroll anchor on scale change, applies to day and week views. Updated frontend component spec with the new geometry contract. Typecheck/build passed.

### Git Commits

| Hash | Message |
|------|---------|
| `a9986b3` | (see git log) |
| `09c9aaf` | (see git log) |

### Status

[OK] **Completed**


## Session 13: Fix zoom +/- semantics and remove scale label

**Date**: 2026-08-27
**Task**: Fix zoom +/- semantics and remove scale label
**Branch**: `fix/inverted-zoom-semantics-remove-ticks`

### Summary

Swapped Timeline zoom button semantics: Plus = zoom in (scale 60->30->15->5, disabled at 5), Minus = zoom out (disabled at 60). Removed the visible scale label span between buttons and the timeline.scaleLabel i18n key; renamed scaleDec/scaleInc to timeline.zoomOut/zoomIn with corrected copy (缩小/放大). Updated component-guidelines.md contract. Typecheck/build passed; dispatched trellis-implement and trellis-check sub-agents (axonhub/glm-5.3-flash).
## Session 13: Adopt Toggl 2.0 layout/form style

**Date**: 2026-08-27
**Task**: Adopt Toggl 2.0 layout/form style
**Branch**: `thankful-frog`

### Summary

Restyle UI to Toggl 2.0 layout: timer bar moved into Shell top bar via new header prop (state extracted to useTimerController hook, TimerPage deleted); page titles in top bar (h1 removed from stats/categories/tags); StatsPage gains total-logged summary card; sidebar nav group label; TimerBar input text-lg, pickers rounded-lg, elapsed text-xl; i18n zh/en nav.group + stats.totalLogged; specs updated. typecheck/build/tests pass.

### Git Commits

| Hash | Message |
|------|---------|
| `c500f00` | (see git log) |
| `abafeed` | (see git log) |

### Status

[OK] **Completed**


## Session 14: CLI/Agent PAT 认证（Bearer token + Web 管理页）

**Date**: 2026-08-27
**Task**: CLI/Agent PAT 认证（Bearer token + Web 管理页）
**Branch**: `feat/cli-agent-auth`

### Summary

新增 api_tokens 表与 Bearer 认证分支（loadUser 仅在有 Authorization 头时查表，cookie 零影响）、GET/POST/DELETE /api/tokens 管理路由、Web TokensPage（创建一次性明文展示/列表/两步确认撤销）、7 个新测试；同步更新 backend/auth.md 与 frontend/api-client.md spec。

### Git Commits

| Hash | Message |
|------|---------|
| `134a04c` | (see git log) |

### Status

[OK] **Completed**


## Session 15: Timeline drag-to-create entries

**Date**: 2026-08-27
**Task**: Timeline drag-to-create entries
**Branch**: `feat/timeline-drag-create-entries`

### Summary

Implemented Toggl-style drag-to-create on the timeline: new POST /api/entries reusing the PATCH validation chain (ownership, half-open overlap -> 409 OVERLAP) with full test coverage; frontend pointer-drag on empty track space with scale-snapped preview (60/30/15/5 -> 15/10/5/1 min), EntryEditor draft mode (category required), week-mode column attribution, and i18n. Specs updated (http-routes, component-guidelines). All AC verified except AC1 manual smoke test.

### Git Commits

| Hash | Message |
|------|---------|
| `b17a8c9` | (see git log) |
| `178b264` | (see git log) |
| `f4e6aed` | (see git log) |

### Status

[OK] **Completed**


## Session 16: 完善用户系统：资料/改密/注销/注册控制 + 设置页

**Date**: 2026-08-29
**Task**: 完善用户系统：资料/改密/注销/注册控制 + 设置页
**Branch**: `feat/user-system`

### Summary

完成 user-system 任务：users 表加 display_name（幂等 ALTER 迁移）；新增 PATCH /api/profile、PATCH /api/account/password（吊销其他会话、保留 PAT）、DELETE /api/account（密码确认+级联清除）、GET /api/meta；REGISTRATION_OPEN 环境变量控制注册（默认开）；Web 端新增 SettingsPage（资料/改密/注销 dialog），Shell footer 用户条目可点入设置，AuthPage 注册 tab 随 meta 禁用；zh/en i18n 同步；新增 account.test.ts，测试 65/65 全绿；更新 backend auth/database/http-routes 与 frontend component/api-client spec。

### Git Commits

| Hash | Message |
|------|---------|
| `a6f4be3` | (see git log) |
| `af4a0ff` | (see git log) |

### Status

[OK] **Completed**


## Session 17: Refactor web design system to teal dual-theme

**Date**: 2026-08-29
**Task**: Refactor web design system to teal dual-theme
**Branch**: `feat/refactor-design-system`

### Summary

Replaced neutral-gray shadcn theme with teal cool-tone dual theme (light+dark) in styles.css; rebuilt 8-color category palette as oklch tokens (--category-1..8) with format.ts COLORS migrated to same-source array; cleaned Timeline hardcoded whites via color-mix/currentColor; added --destructive-foreground; WCAG AA contrast verified by script (research/contrast-report.md); added spec/frontend/design-tokens.md and fixed stale light-only notes in component/quality guidelines. AC8 manual visual check across 8 pages x dual themes pending user verification.

### Git Commits

| Hash | Message |
|------|---------|
| `2466ae1` | (see git log) |
| `8812fd1` | (see git log) |

### Status

[OK] **Completed**


## Session 18: Move sidebar extras into tabbed settings page

**Date**: 2026-08-29
**Task**: Move sidebar extras into tabbed settings page
**Branch**: `feat/sidebar-items-to-tabbed-settings`

### Summary

Slimmed the sidebar: nav keeps timer/stats/categories/tags only, footer keeps only the user entry. SettingsPage rebuilt as three tabs — General (language + theme), Account (profile/password/logout/danger zone), API Tokens (embedded TokensPage). Removed PageId 'tokens', synced zh/en i18n keys, updated frontend component-guidelines spec.

### Git Commits

| Hash | Message |
|------|---------|
| `a95d932` | (see git log) |

### Status

[OK] **Completed**


## Session 19: Fix settings tab scrollbar and split sidebar footer entries

**Date**: 2026-08-29
**Task**: Fix settings tab scrollbar and split sidebar footer entries
**Branch**: `feat/sidebar-items-to-tabbed-settings`

### Summary

Removed the unnecessary overflow-x-auto on SettingsPage TabsList (permanent desktop scrollbar). Sidebar footer split per plan B: username is now a non-interactive display (pointer-events-none, tabIndex=-1), with a separate Settings-icon entry (lucide Settings + nav.settings) that navigates to settings and closes the mobile drawer. Updated component-guidelines spec accordingly.

### Git Commits

| Hash | Message |
|------|---------|
| `c9ee62e` | (see git log) |

### Status

[OK] **Completed**
