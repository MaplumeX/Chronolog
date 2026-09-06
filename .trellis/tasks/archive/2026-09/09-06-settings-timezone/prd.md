# Add timezone setting with global date/time display

## Goal

用户可以在设置中配置自己的时区，持久化到用户配置（服务端 users 表），并影响全局所有日期/时间的展示与查询窗口（Timer 时间轴、周视图、统计、目标等）。未设置时保持现有行为（跟随浏览器时区）。

## Background（已确认事实）

- 前端所有时间展示与查询窗口均以 `tz` 字符串驱动：
  - `web/src/format.ts:3` `browserTz()` 返回 `Intl.DateTimeFormat().resolvedOptions().timeZone`，是当前唯一的 tz 来源。
  - 消费方：`use-timer-controller.tsx:53`、`StatsPage.tsx:101`、`GoalsPage.tsx:47`。
- 后端所有相关端点（today/week/boundary/stats/goals）均接受前端传入的 `tz` query 参数并用 `server/src/time.ts` 的 `requireTz`（luxon IANAZone 校验）+ 日界计算，服务端不存储用户时区。
- 用户配置现状：`users` 表有 `display_name TEXT`（可空），`/api/auth/me` 与 `PUT profile`（`server/src/routes/account.ts`）返回 `{ id, username, displayName }`；前端 `User` 类型在 `web/src/api.ts:3`。
- 设置页 `web/src/pages/SettingsPage.tsx`：General tab 有语言/主题切换（即时生效、本地存储），Profile 卡片（用户名/显示名）走保存按钮；时区控件放入 General tab。
- 数据库迁移模式：`server/src/db.ts` `migrate()` 幂等 ALTER TABLE 加列（参考 display_name 的做法）。

## Requirements

### R1 服务端持久化

- `users` 表新增可空列 `timezone TEXT`（NULL = 未设置，跟随浏览器）。
- `/api/auth/me` 与 profile 更新端点返回 `timezone`（null 或 IANA 时区字符串）。
- 更新 profile 支持可选 `timezone` 字段；传值时用 `requireTz` 语义校验（无效 → 400 VALIDATION）；允许传空字符串/null 清除设置。
- 幂等迁移：新库 SCHEMA_SQL 建列 + 老库 ALTER TABLE。

### R2 设置页 UI

- 时区控件放入 Settings 的 **Profile 卡片**（与用户名/显示名同一表单），随「保存」按钮一起提交（用户决策 Q1：不走即时保存）。
- 选择器包含默认项「跟随浏览器」（值 = 空字符串，提交后服务端置 null），以及时区列表（IANA 名称，来自 `Intl.supportedValuesOf("timeZone")`，列表当前项高亮、可滚动）。
- 仅当时区相对 `props.user.timezone` 发生变化时随表单提交 `timezone` 字段（与 username/displayName 的差异提交模式一致）。
- i18n：中英文案（zh/en）。

### R3 前端全局生效

- App 顶层从 `user.timezone ?? browserTz()` 派生 tz，替换各消费方直接调用 `browserTz()` 的地方（timer controller、Stats、Goals）。
- 用户未设置时区时行为与现状完全一致。
- 切换时区后，所有依赖 tz 的视图（今日/本周条目、统计窗口、目标周期、时间轴标签）刷新为新时区。

## Acceptance Criteria

- [ ] 新用户 / 未设置时区的老用户：行为与现在一致（跟随浏览器时区），无迁移错误。
- [ ] 设置页可选时区并保存；刷新页面后设置保留（持久化到服务端）。
- [ ] 设置如 "America/New_York" 后：今日条目窗口、周视图、统计、目标页均按该时区计算/展示。
- [ ] 传无效时区字符串到更新端点 → 400 VALIDATION。
- [ ] 「跟随浏览器」选项可清除已存时区（timezone 置回 null）。
- [ ] `npm run typecheck` 与 `npm test`（server + web）通过。
- [ ] i18n zh/en 文案齐全。

## Out of Scope

- 后端按用户时区自动推断（服务端仍以请求的 tz 参数为准，只是来源变为用户设置）。
- 时间条目的存储格式变更（仍存 UTC ISO）。
- 每用户时区历史/多时区对比视图。
