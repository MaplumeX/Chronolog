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


## Session 19: Move sidebar extras into tabbed settings page

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


## Session 18: 分类颜色：透明度 + light/dark 双套色板

**Date**: 2026-08-29
**Task**: 分类颜色：透明度 + light/dark 双套色板
**Branch**: `feat/category-color-transparency-dual-scheme`

### Summary

拆分 --category-1..8 为 light（L=0.72）/dark（L=0.54）双套并新增 --category-N-foreground token；format.ts 仅持 token 名（categoryIndex + categoryColor 返回 var(--category-N)），删除 contrastText/relativeLuminance JS 计算；Timeline 块底色 color-mix 80% 半透明，小元素保持实色。对比度验证 light 7.5-8.0:1、dark 6.0-6.5:1；typecheck/build/后端测试通过；spec design-tokens.md 已同步。

### Git Commits

| Hash | Message |
|------|---------|
| `a95d932` | (see git log) |

### Status

[OK] **Completed**


## Session 20: Fix settings tab scrollbar and split sidebar footer entries

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


## Session 21: Recolor category palette to softer balanced-wheel scheme

**Date**: 2026-08-29
**Task**: Recolor category palette to softer balanced-wheel scheme
**Branch**: `feat/recolor-stats-tag-entries`

### Summary

Replaced all 32 category color tokens (light/dark, base+foreground) in web/src/styles.css with a softer low-saturation palette (light 0.74/0.09, dark 0.58/0.08) using a warm-4/cold-4 balanced hue wheel (15/50/100/135/250/285/315/345), still avoiding the 185-225 teal range reserved for primary. Chose 'balanced wheel' option after comparing 4 hue-distribution candidates with the user. format.ts hash mapping untouched; design-tokens.md spec synced. Verified via trellis-check (all pass) and npm build.

### Git Commits

| Hash | Message |
|------|---------|
| `8e7a858` | (see git log) |

### Status

[OK] **Completed**


## Session 24: Timeline gap placeholder slots

**Date**: 2026-08-29
**Task**: Timeline gap placeholder slots
**Branch**: `feat/placeholder-entry-between-items`

### Summary

实现时间线条目间空档占位插槽：新增 GET /api/entries/boundary 返回查询窗口紧邻外侧条目（prev 含 running 无穷右端、next 取最小 startedAt），前端 computeGaps 按全部数据计算全局 gap（含跨天/跨多天投影），.timeline-slot 虚线边框+半透明灰静态渲染（<10px 不显示），点击以整个空档预填 EntryEditor 复用 draft popover 链路，anchor 快照化防脱锚；拖拽创建 pointerdown 早退 .timeline-slot。check 发现并修复空视图幽灵插槽（M1）与 anchor 失配（m1）。72 tests + typecheck 全绿。
## Session 23: 重构统计页面：范围切换、趋势图、分类占比与标签统计

**Date**: 2026-08-29
**Task**: 重构统计页面：范围切换、趋势图、分类占比与标签统计
**Branch**: `refactor/statistics-page`

### Summary

新增 GET /api/stats/range 聚合端点（DST 安全逐日窗口、92 天上限、多标签全额计入+无标签桶，6 个测试）；前端引入 recharts 3.10，StatsPage 重构为 today/week/month/custom 四档位：每日趋势 BarChart、分类占比 donut+百分比列表、纯 CSS 标签条形（无标签桶）；仅 today 档 5s 轮询且跨午夜自动滚动；zh/en i18n 同步；spec 四处更新（component-guidelines/api-client/http-routes/time-and-timezone）。
## Session 22: Beautify entry time picker with custom DateTimePicker

**Date**: 2026-08-29
**Task**: Beautify entry time picker with custom DateTimePicker
**Branch**: `feat/beautify-time-picker-in-entries`

### Summary

Replaced native datetime-local inputs in EntryEditor with a custom DateTimePicker (Popover + Calendar + HH:MM:SS stepper TimeFields) matching the teal dual-theme picker styling. Value contract YYYY-MM-DDTHH:mm:ss unchanged; keyboard stepping/typing with clamp and auto-advance; 'Now' shortcut; i18n entry.now zh/en. Updated component-guidelines spec. typecheck+build pass.

### Git Commits

| Hash | Message |
|------|---------|
| `3628901` | (see git log) |
| `9799529` | (see git log) |
| `4a7e87a` | (see git log) |

### Status

[OK] **Completed**


## Session 23: Allow editing running timer's description, category and tags

**Date**: 2026-08-30
**Task**: Allow editing running timer's description, category and tags
**Branch**: `feat/edit-task-while-timing`

### Summary

Added PATCH /api/timer/current (description/categoryId/tagIds, ownership validation, 409 without running timer) and made the TimerBar editable while running: description saves via 600ms debounce, category/tag changes save immediately and refresh timeline data; stopping cancels the pending debounce. Server tests (80 pass) and typecheck green; specs updated (http-routes, component-guidelines, state-management).

### Git Commits

| Hash | Message |
|------|---------|
| `187d33a` | (see git log) |

### Status

[OK] **Completed**


## Session 24: Docker deployment hardening and CI/CD release automation

**Date**: 2026-08-30
**Task**: Docker deployment hardening and CI/CD release automation
**Branch**: `main`

### Summary

Added /api/health endpoint; slimmed runtime Docker image (prod-only server deps, non-root user, tini, HEALTHCHECK); compose healthcheck + log rotation; CI workflow (typecheck/tests); release workflow pushing multi-arch images to GHCR and creating conventional-changelog GitHub Releases on version tags; README deploy/release docs. Local build and runtime verified, 80/80 tests pass.

### Git Commits

| Hash | Message |
|------|---------|
| `12366de` | (see git log) |
| `d0cff58` | (see git log) |

### Status

[OK] **Completed**


## Session 25: Change host port to 2259

**Date**: 2026-08-30
**Task**: Change host port to 2259
**Branch**: `main`

### Summary

Changed docker-compose host port mapping from 8080 to 2259 (container port unchanged).

### Git Commits

| Hash | Message |
|------|---------|
| `c454a20` | (see git log) |

### Status

[OK] **Completed**


## Session 26: 分类/标签色板配色编辑

**Date**: 2026-08-30
**Task**: 分类/标签色板配色编辑
**Branch**: `feat/category-tag-color-editing`

### Summary

为分类/标签新增可编辑配色：DB 加可空 color 列（1–8 色板索引，幂等迁移），POST/PATCH 支持可选 color（至少其一，非法值 400），前端管理页重命名改为编辑 Popover（名称+8色板+自动），全部展示位（Timeline/Stats/Picker/TimerBar）显式色优先、hash 回退。82 测试全绿，spec 四处已更新。
## Session 26: Release v0.1.0

**Date**: 2026-08-30
**Task**: Release v0.1.0
**Branch**: `main`

### Summary

Pushed pending commits, tagged v0.1.0 and ran the release workflow. Fixed broken changelog action references (docker/ and bcoe/conventional-changelog-action both removed upstream) by generating the changelog inline via conventional-changelog-cli and extracting the tag's section. Result: multi-arch (amd64/arm64) image pushed to ghcr.io/maplumex/chronolog with 0.1.0/0.1/latest tags, GitHub Release v0.1.0 created with conventional-changelog body.

### Git Commits

| Hash | Message |
|------|---------|
| `24e68dc` | (see git log) |

### Status

[OK] **Completed**


## Session 27: 色板去除自动选项，创建即固定颜色

**Date**: 2026-08-30
**Task**: 色板去除自动选项，创建即固定颜色
**Branch**: `feat/category-tag-color-editing`

### Summary

去除色板「自动」选项：创建分类/标签时用 trim 后名称 hash 生成颜色直接随 POST 落库；编辑浮窗 8 色点必选其一（无自动），旧 NULL 数据打开时默认选中 hash 回退色、保存固化；改名不重新 hash。后端零改动，82 测试全绿，spec 已更新。

### Git Commits

| Hash | Message |
|------|---------|
| `104b99d` | (see git log) |
| `d75ffb9` | (see git log) |
| `ff1e93b` | (see git log) |

### Status

[OK] **Completed**


## Session 28: 目标（Goal）功能：后端 API + 前端目标页

**Date**: 2026-08-30
**Task**: 目标（Goal）功能：后端 API + 前端目标页
**Branch**: `feat/goal-feature`

### Summary

完成目标功能全栈实现：goals 表 + periodBounds(day/week/month, DST 安全) + /api/goals CRUD 与 tz 感知的当前周期进度（读取时计算，clipSeconds 截断）；分类/标签被目标引用时删除 409；前端 GoalsPage 表格（进度条、状态徽标、过期置灰末尾、两步删除确认、30s 轮询）+ GoalEditorDialog（emoji 网格、可选分类/标签、方向/小时/周期/截止日期）+ 侧边栏入口 + zh/en i18n。95 测试全过（新增 13），typecheck/build 通过。关键决策：周期为独立滚动窗口（Q1-A）、单分类+单标签 AND 匹配（Q2）、emoji 图标（Q3）、截止日期可选过期置灰（Q4-A）、进度实时计算非快照。

### Git Commits

| Hash | Message |
|------|---------|
| `08ee90a` | (see git log) |

### Status

[OK] **Completed**


## Session 29: 分类与标签两级层级支持

**Date**: 2026-08-30
**Task**: 分类与标签两级层级支持
**Branch**: `feat/hierarchical-categories-and-tags`

### Summary

分类与标签支持父子两级层级：schema/db 迁移加 parent_id（老库幂等升级、删旧唯一索引改应用层按父查重）、categories/tags CRUD 层级校验与级联删除、stats today/range 新增 rollup 参数（子分类秒数并入父分类桶）；前端管理页两级树 + 添加子级/改父级、选择器分组缩进展示、统计页独立/汇总切换。后端 105 测试全绿（含迁移回归），前端 build/typecheck 通过。

### Git Commits

| Hash | Message |
|------|---------|
| `480adf1` | (see git log) |

### Status

[OK] **Completed**


## Session 30: 修复跨天条目时间线几何裁剪与信息展示

**Date**: 2026-08-31
**Task**: 修复跨天条目时间线几何裁剪与信息展示
**Branch**: `fix/cross-day-entry-display`

### Summary

修复跨天（跨午夜）条目在 Timeline 的显示：色块几何用 clipRangeMs 夹到当天窗口（昨晚→今天不再从 0:00 画过头）；块上/tooltip 时长改用整条 durationSeconds（2h 而非切片 1h）；时间范围用 formatEntryTimeRange 加日属标记（同天 HH:MM、±1天 昨天/明天、跨多天 MM-DD，相对该列日期、DST 安全）；列头当日合计仍按切片 cl 不变；新增 i18n key timeline.dayRel.prev/next（zh/en）。spec 记录跨天渲染契约。trellis-check 全绿（无 blocker/M 级），typecheck+build+server105 tests 通过。
## Session 30: 重构整体布局结构与视觉层级（Linear 风轻卡片体系）

**Date**: 2026-08-31
**Task**: 重构整体布局结构与视觉层级（Linear 风轻卡片体系）
**Branch**: `refactor/layout-visual-hierarchy`

### Summary

全应用视觉/布局重构：底—面两级表面 token（light 灰底白卡 / dark 深底亮面卡）+ 双主题 --shadow-xs；新建 ui/card 六件套与 PageContainer 三档限宽容器；Shell 顶栏标题升至 text-xl tracking-tight；6 页面统一为「工具栏行 → 模块 Card」三段式（表格入卡、统计四张模块卡、设置分组卡、Auth 表单卡）；Timeline 本体零改动；推翻 spec 的 no-card 约定并同步修订 component-guidelines 与 design-tokens。typecheck/build 全绿，WCAG AA 18 组配对验算通过，全 scope check 9/9 PASS。

### Git Commits

| Hash | Message |
|------|---------|
| `8b60813` | (see git log) |
| `a0b9865` | (see git log) |

### Status

[OK] **Completed**


## Session 31: 跨天日属标记改为相对真实今天

**Date**: 2026-08-31
**Task**: 跨天日属标记改为相对真实今天
**Branch**: `fix/cross-day-entry-display`

### Summary

按反馈把 Timeline 跨天日属标记的锚点从「被查看的列日期」改为「真实今天」（formatEntryTimeRange 新增 nowMs 参数，移除不再用的 columnDayStartMs；diff 改为与 todayOrd 相减）。例如 23:00→01:00 跨进今天，看昨天列时右端 01:00 不再显示「明天」，而是与今天同天无前缀、左端标「昨天」，读作「昨天 23:00 – 01:00」。同步更新 spec 跨天渲染契约为「相对真实今天」。typecheck+build+server105 tests 全绿。

### Git Commits

| Hash | Message |
|------|---------|
| `7488a48` | (see git log) |
| `46ecf0d` | (see git log) |

### Status

[OK] **Completed**


## Session 32: 跨天时间范围改为两端完整日期

**Date**: 2026-08-31
**Task**: 跨天时间范围改为两端完整日期
**Branch**: `fix/cross-day-entry-display`

### Summary

按反馈放弃「昨天/明天」相对词方案：formatEntryTimeRange 改为——非跨天条目 HH:MM – HH:MM；跨天条目起止两端都带 MM-DD 完整日期（含落在今天的那端），如 08-30 23:00 – 08-31 01:00；跨多天同理；运行中条目右端仍为 …（跨天判断以 startedAt 与 nowMs 比较）。移除不再用的 i18n key timeline.dayRel.prev/next（zh/en）。node 内联验证 5 种场景输出正确；typecheck+build+server105 tests 全绿；spec 跨天契约同步更新。

### Git Commits

| Hash | Message |
|------|---------|
| `1f7b35a` | (see git log) |
| `0d845a2` | (see git log) |
| `a362bb7` | (see git log) |

### Status

[OK] **Completed**


## Session 34: Replace entry time picker segment input with native time input

**Date**: 2026-08-31
**Task**: Replace entry time picker segment input with native time input
**Branch**: `fix/entry-time-input-bug`

### Summary

Fixed buggy HH:MM:SS three-segment TimeField steppers in DateTimePicker (auto-advance on 2 digits, 23->00 hour wrap without date carry). Replaced with a single native <input type="time" step={1}> via ui/input: browser-owned segment editing, empty values never submitted, color-scheme adapts light/dark. Value contract YYYY-MM-DDTHH:mm:ss unchanged; EntryEditor untouched. component-guidelines spec updated. typecheck+build pass; trellis-check all PASS.

### Git Commits

| Hash | Message |
|------|---------|
| `0099921` | (see git log) |

### Status

[OK] **Completed**


## Session 35: Add time entry deletion

**Date**: 2026-08-31
**Task**: Add time entry deletion
**Branch**: `fix/time-entry-delete`

### Summary

Added DELETE /api/entries/:id (owner 404, running 409, cascade-cleaned entry_tags) plus a two-click confirm delete button in the EntryEditor popover (edit mode only), with zh/en i18n. Server tests 108/108 pass; specs updated.

### Git Commits

| Hash | Message |
|------|---------|
| `c7ee42b` | (see git log) |

### Status

[OK] **Completed**


## Session 36: 建立完善的测试体系（web 测试基建 + server 补强）

**Date**: 2026-08-31
**Task**: 建立完善的测试体系（web 测试基建 + server 补强）
**Branch**: `feat/testing-system`

### Summary

为 web 从零引入 Vitest3+jsdom+Testing Library 测试栈，覆盖纯逻辑/hooks/CategoryPicker 组件冒烟（96 用例，hierarchy/lib/utils/use-mobile 100%、format 92.8%）；server 补 Node 原生覆盖率（98% 行覆盖）与全局错误处理测试 errors.test.ts（6 用例，共 114）；根 npm test/test:coverage 串联两端，CI 无需改动。同步更新 frontend/backend quality-guidelines 与 api-client spec。

### Git Commits

| Hash | Message |
|------|---------|
| `dd14c31` | (see git log) |

### Status

[OK] **Completed**


## Session 37: Categories/Tags pages tree-list redesign

**Date**: 2026-08-31
**Task**: Categories/Tags pages tree-list redesign
**Branch**: `feat/refactor-categories-tags-pages`

### Summary

Replaced duplicated CategoriesPage/TagsPage tables (~400 lines) with shared generic HierarchicalListCard: collapsible two-level tree (chevron, default expanded, guide-line indent), hover-revealed actions, unified two-click delete confirm, category occupied-delete guard preserved. Thin page shells keep API glue + fixed-at-creation color logic. 108 tests green, build green. Spec: component-guidelines updated (tree-list card contract, table-in-card scope narrowed to Goals/Tokens).

### Git Commits

| Hash | Message |
|------|---------|
| `c47602c` | (see git log) |

### Status

[OK] **Completed**


## Session 38: 条目删除与分类/标签删除改为弹窗确认

**Date**: 2026-08-31
**Task**: 条目删除与分类/标签删除改为弹窗确认
**Branch**: `feat/modify-deletion-approach`

### Summary

新建共享 ConfirmDialog 组件（基于 shadcn Dialog，纯展示、文案由调用方 t() 传入、pending 禁双按钮）；EntryEditor 与 HierarchicalListCard 的行内两步删除确认改为弹窗确认，父级删除弹窗内提示级联子级数量，deleteDisabled 禁删规则不变；zh/en 新增弹窗文案并清理废弃行内确认键（保留 goals.confirmDelete）；HierarchicalListCard 测试改为弹窗交互断言；更新 frontend component-guidelines spec 记录 ConfirmDialog 契约。

### Git Commits

| Hash | Message |
|------|---------|
| `1abe889` | (see git log) |

### Status

[OK] **Completed**


## Session 39: 分类归档功能

**Date**: 2026-09-01
**Task**: 分类归档功能
**Branch**: `feat/add-category-archive`

### Summary

实现分类归档功能：categories 加 archived_at 列（幂等迁移 + time_entries 表重建使 category_id 可空）；新增 archive/unarchive 接口（归档父级连带子级、取消归档级联恢复祖先链）；删除约束放宽为置 NULL 转未分类（entries leftJoin + coalesce 兜底名）；前端分类页归档分区展示、CategoryPicker 过滤归档分类。server 123 + web 115 测试全过，spec 四个文档同步更新。

### Git Commits

| Hash | Message |
|------|---------|
| `edef79e` | (see git log) |

### Status

[OK] **Completed**


## Session 40: Tree-list row actions dropdown menu

**Date**: 2026-09-01
**Task**: Tree-list row actions dropdown menu
**Branch**: `feat/move-category-buttons-into-menu`

### Summary

Collapsed the flat per-row action buttons in HierarchicalListCard (categories/tags) into a single ⋯ DropdownMenu: add child (active parents) / edit / archive / destructive delete, confirm-dialog flows unchanged. AddChildPopover and NameColorEditPopover refactored into pure form-content components opened via a row-level controlled Popover anchored to the menu trigger (PopoverAnchor virtualRef; anchor read inside onSelect). Added {categories,tags}.moreActions i18n (zh/en), rewrote component tests (120 passing), updated frontend component-guidelines spec.

### Git Commits

| Hash | Message |
|------|---------|
| `0fba63e` | (see git log) |

### Status

[OK] **Completed**


## Session 41: Token revoke confirm via shared ConfirmDialog

**Date**: 2026-09-02
**Task**: Token revoke confirm via shared ConfirmDialog
**Branch**: `fix/token-revoke-confirm`

### Summary

TokensPage 撤销确认从行内两步按钮改为共享 ConfirmDialog（pending 防重复提交，描述插值 token 名并提示立即失效不可恢复），zh/en 新增 revokeTitle/revokeDescription 文案并删除 confirmRevoke；同步更新 frontend/component-guidelines.md 的 ConfirmDialog 使用方清单。无 Trellis task（用户选择直接改），typecheck + 120 个 web 测试通过。

### Git Commits

| Hash | Message |
|------|---------|
| `a77761f` | (see git log) |

### Status

[OK] **Completed**


## Session 42: Fix row-menu popover closing instantly after add-child/edit

**Date**: 2026-09-05
**Task**: Fix row-menu popover closing instantly after add-child/edit
**Branch**: `fix/add-child-edit-buttons`

### Summary

Tree-list ⋯ menu 添加子级/编辑 弹层在真实浏览器闪现即关：菜单卸载时 MenuItem onPointerLeave → onItemLeave 把焦点抢回菜单容器，PopoverAnchor virtualRef 无 Radix targetIsTrigger 豁免，focus-outside 判定成立导致弹层秒关（jsdom 无真实指针/焦点时序测不出，120 测试全绿掩盖了 bug）。用 Playwright 事件追踪定位根因后，在 HierarchicalListCard 加 popoverOpenedAtRef 时间戳 + PopoverContent onFocusOutside 300ms 豁免窗口；指针外点与 Escape 关闭路径不受影响。Chromium 实测创建子级/改名保存成功，120/120 测试 + typecheck 通过；spec component-guidelines 补充守卫契约。

### Git Commits

| Hash | Message |
|------|---------|
| `b5c1278` | (see git log) |

### Status

[OK] **Completed**


## Session 43: Add user timezone setting with global date/time display

**Date**: 2026-09-06
**Task**: Add user timezone setting with global date/time display
**Branch**: `feat/settings-timezone`

### Summary

Implemented per-user timezone setting (task 09-06-settings-timezone): users.timezone nullable column with idempotent migration; register/login/me/profile carry timezone; PATCH /api/profile accepts optional IANA-validated timezone (empty string clears). Frontend derives tz = user.timezone ?? browserTz() at App level and passes it to useTimerController/StatsPage/GoalsPage; Settings profile card gained a timezone DropdownMenu (follow-browser default + supportedTimezones/tzUtcOffsetLabel helpers, zh/en i18n). Specs synced (backend db/http/time, frontend api-client/state/component). typecheck + all 253 tests green.

### Git Commits

| Hash | Message |
|------|---------|
| `527e5f5` | (see git log) |
| `ef0edca` | (see git log) |

### Status

[OK] **Completed**


## Session 44: Auto-persist detected browser timezone

**Date**: 2026-09-06
**Task**: Auto-persist detected browser timezone
**Branch**: `feat/settings-timezone`

### Summary

Switched timezone default to detect-then-persist (task 09-06-timezone-autodetect-persist): App auto-saves browserTz() via one-shot fire-and-forget updateProfile when user.timezone is null (per-user-id dedup, silent failure, retry next visit; manual zones never overwritten). Removed the follow-browser dropdown item; settings baseline is user.timezone ?? browserTz(). Frontend-only, 5 new App.test.tsx cases; specs synced. typecheck + all tests green (server 121, web 132).

### Git Commits

| Hash | Message |
|------|---------|
| `26b2cfc` | (see git log) |

### Status

[OK] **Completed**


## Session 46: 无间隙计时功能：停止后自动开始下一段

**Date**: 2026-09-08
**Task**: 无间隙计时功能：停止后自动开始下一段
**Branch**: `feat/continuous-timing`

### Summary

实现无间隙计时模式：users.continuous_timing 服务端设置（设置页开关，默认关闭）；开启后 POST /api/timer/stop 在同一事务停止旧段并以同一时间戳创建未分类新段，响应返回新段；前端按 entry.stoppedAt===null 区分换段/完全停止，换段后自动弹出分类选择器（CategoryPicker 新增受控 open/onOpenChange props）。产品决策：开关仅设置页（方案C）、新段说明/标签空+分类NULL、完全停止需先关开关（方案A）。新增 ui/switch.tsx。server 132 / web 135 测试全绿；spec 已更新（http-routes/database/api-client/component/state-management）。
## Session 45: Fix time-overlap string comparison defect

**Date**: 2026-09-08
**Task**: Fix time-overlap string comparison defect
**Branch**: `emdash/wicked-areas-greet-78gtx`

### Summary

确认时间重叠判定语义（半开区间）本身正确，但比较实现有缺陷：z.iso.datetime 不规范化格式，混格式 ISO（无毫秒 Z vs .000Z）入库后字典序比较与时刻序不一致，导致边界相接误报 409 OVERLAP、.5Z 顺序误报 400、真实重叠漏检（API token 外部客户端可触发）。修复：routes/entries.ts 新增 isoInstant schema（z.iso.datetime + toISOString transform），updateBody 与 boundaryQuery 统一规范化为 .000Z；补 POST/PATCH/boundary 混格式回归测试（server 128 pass）；更新 http-routes/time-and-timezone spec 记录规范化约定。

### Git Commits

| Hash | Message |
|------|---------|
| `236377c` | (see git log) |
| `066b52d` | (see git log) |

### Status

[OK] **Completed**


## Session 47: 网站移动端适配（触屏体验重设计）

**Date**: 2026-09-08
**Task**: 网站移动端适配（触屏体验重设计）
**Branch**: `emdash/puny-plants-refuse-bud59`

### Summary

移动端全面适配（09-08-mobile-responsive）：①移动端用底部 5 Tab 导航（MobileTabBar，nav-items.ts 共享常量）+ 顶栏设置入口替换 Sidebar 抽屉，桌面路径 DOM 等价不变；②Timeline week 视图 w-max 统一宽度容器实现横向滚动+表头对齐，触屏经 useIsMobile 短路 onDragCreate（gap 点击成为唯一创建路径），styles.css 新增 <768px 刻度尺几何块；③@meida (hover: none) 能力断点实现 touch-hit（≥40px 命中区，伪元素扩展）与 touch-always-visible（hover-reveal 触屏常显），PopoverContent 全局窄屏 clamp，GoalEditorDialog 窄屏堆叠，TabsList overflow-x-auto。三轮 check 抓出并修复 3 个实质缺陷：.timeline-track--full 特异度覆盖（week 列错位 blocker）、空伪元素宽度塌缩为 0（DateNav 命中区失效 blocker）、相邻缩放按钮伪元素互相覆盖（改方向性扩展 touch-hit--x）。测试 144→150 用例全绿；frontend spec 已同步（底部 Tab 推翻旧 drawer 约定、宽度/能力双断点策略、伪元素塌缩 gotcha）。遗留：真机人工验证清单（safe-area、week 滑动手感、Popover 翻转、AC5 端到端闭环）。

### Git Commits

| Hash | Message |
|------|---------|
| `bb1e000` | (see git log) |
| `f493752` | (see git log) |
| `d0c0b2b` | (see git log) |
| `a39957d` | (see git log) |
| `644c677` | (see git log) |

### Status

[OK] **Completed**


## Session 48: Day timeline entries axis subview

**Date**: 2026-09-08
**Task**: Day timeline entries axis subview
**Branch**: `emdash/floppy-glasses-hunt-qvw14`

### Summary

Added a block/entries subview toggle to day mode (persisted chronolog-day-subview). EntryListView renders a non-proportional flow list: two-line time column (start/end, running '···'), variable-height category-tinted cards with running breathe animation, dashed ghost cards for gap backfill, asc/desc sort with persistence, and a footer tally. computeGaps extracted to timeline-gaps.ts shared by both subviews; week mode unchanged. Fixed check-found regressions: week zoom buttons preserved, hover lift moved to CSS, single-line running indicator, day-switch rescroll, ghost touch target 44px. 161 tests green.
## Session 50: 相邻时间条目上下合并功能

**Date**: 2026-09-08
**Task**: 相邻时间条目上下合并功能
**Branch**: `emdash/fiery-candies-train-x65eg`

### Summary

实现条目与紧邻上一条/下一条合并：后端 POST /api/entries/:id/merge（事务内服务端权威重判相邻性/所有权/停止状态，区间取 min/max 覆盖空隙，属性整条二选一保留）；前端 EntryEditor 合并按钮 + 新 MergeDialog 双卡预览二选一，Timeline 用视图条目+boundary 提供相邻候选。server 143 测试、web 154 测试全绿，spec 已同步（http-routes/api-client/component-guidelines）。
## Session 48: Fix settings tabs scrollbar

**Date**: 2026-09-08
**Task**: Fix settings tabs scrollbar
**Branch**: `emdash/hungry-kids-unite-v8p9i`

### Summary

Fixed a constant vertical scrollbar on the settings page tabs: the active TabsTrigger underline (after:bottom-[-5px]) overflows the h-9 TabsList, and overflow-x-auto forces overflow-y to auto. Added pb-[5px] to the TabsList so the underline fits; horizontal scrolling preserved for narrow screens.

### Git Commits

| Hash | Message |
|------|---------|
| `0ba3e2d` | (see git log) |
| `c909093` | (see git log) |
| `a30c908` | (see git log) |

### Status

[OK] **Completed**


## Session 49: Remove entries-subview sort toggle

**Date**: 2026-09-08
**Task**: Remove entries-subview sort toggle
**Branch**: `emdash/floppy-glasses-hunt-qvw14`

### Summary

Removed the asc/desc sort toggle from the entries axis subview per user feedback: rows are fixed ascending by start time. Dropped the chronolog-entry-view-sort persistence, timeline.sortAsc/sortDesc i18n keys, updated tests (ascending-order assertion + no-write assertion) and spec docs. 161 tests green.
## Session 49: Persist timeline view mode and scale to localStorage

**Date**: 2026-09-08
**Task**: Persist timeline view mode and scale to localStorage
**Branch**: `emdash/tender-banks-attend-t4osu`

### Summary

Timer 页时间线偏好持久化：view（day/week）与 scale（60/30/15/5）照 chronolog-date-view 模式写入 localStorage（chronolog-view-mode / chronolog-scale），垃圾值回退默认、隐私模式静默降级；新增 14 个单测，同步更新 state-management.md spec。164 测试全过，typecheck/build 通过。

### Git Commits

| Hash | Message |
|------|---------|
| `78aa57a` | (see git log) |
| `d6a7b63` | (see git log) |

### Status

[OK] **Completed**
