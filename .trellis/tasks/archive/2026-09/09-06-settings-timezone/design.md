# Design: Add timezone setting with global date/time display

## 架构总览

现有架构：tz 是纯请求参数，前端每处自取 `browserTz()`。本任务在**用户配置**层新增持久化时区，前端改为单一来源 `user.timezone ?? browserTz()`，服务端所有窗口计算逻辑**不变**（仍以请求的 `tz` 为准）。

```
SettingsPage (Profile 卡片) --PATCH /api/profile {timezone?}--> users.timezone (TEXT NULL)
/api/auth/me + PATCH /api/profile 返回 { id, username, displayName, timezone }
App: const tz = user?.timezone ?? browserTz()
  ├─ useTimerController({ tz, ... })
  ├─ StatsPage({ tz })
  └─ GoalsPage({ tz })
```

## 数据与契约

### DB（server/src/db.ts, schema.ts）

- `users` 新列 `timezone TEXT`（NULL = 未设置）。
- SCHEMA_SQL 的 users 表加 `timezone TEXT`；`migrate()` 按 display_name 模式幂等 ALTER（`server/src/db.ts:116-122` 参考）。
- drizzle schema `users` 加 `timezone: text("timezone")`。

### API 契约

- `AuthUser`（`server/src/auth.ts:87`）加 `timezone: string | null`；`loadUser` 两个分支（bearer token / session）与 login 响应都带上 `timezone: row.timezone ?? null`。
- `PATCH /api/profile`（`server/src/routes/account.ts`）：
  - `profileBody` 加 `timezone: z.string().max(64).optional()`；refine 条件扩为「至少一个字段」包含 timezone。
  - 校验：非空字符串 → 复用 `requireTz` 语义（`IANAZone.isValidZone`，无效抛 400 VALIDATION「时区无效」）；空字符串 → 存 null（清除）。
  - 响应 `{ id, username, displayName, timezone }`。
- `GET /api/auth/me`、`POST /api/auth/login` 响应加 `timezone`。
- 注意：requireTz 当前在 `server/src/time.ts` 且带「不能为空」语义，profile 的空串语义不同——直接用 `IANAZone.isValidZone` 校验非空值即可，不强行复用 requireTz。

### 前端契约（web/src/api.ts）

- `User` 类型加 `timezone: string | null`。
- `updateProfile` body 类型加 `timezone?: string`（空字符串表示清除）。

## 前端数据流

### App 顶层（web/src/App.tsx）

- `const tz = user?.timezone ?? browserTz()`（user 为 null/undefined 时 browserTz 兜底，实际未登录不渲染数据视图）。
- 作为 prop 传入 `useTimerController({ tz })`、`<StatsPage tz />`、`<GoalsPage tz />`。
- **刷新语义**：`onUserUpdated` 更新 user 后，tz 随之变化 → React 重渲染，各视图 useEffect 依赖 `tz` 触发重新拉取（timer controller 的 refresh effect 需把 `tz` 加入依赖数组）。

### use-timer-controller.tsx

- props 加 `tz: string`，删除内部 `browserTz()` 调用（第 53 行）。
- `refresh` 依赖 effect（第 103 行）加 `tz`；`onDateChange` 等闭包内引用改为 props.tz。

### StatsPage / GoalsPage

- props 加 `tz: string`，替换各自 `const tz = browserTz()`（StatsPage:101、GoalsPage:47）。
- 两者内部数据拉取 useEffect 需确认 tz 在依赖数组中（切换时区后自动刷新）。

### SettingsPage（Profile 卡片）

- state：`const [timezone, setTimezone] = useState(props.user.timezone ?? "")`（"" = 跟随浏览器）。
- 下拉：复用 `dropdown-menu` 模式（参考 `LanguageSwitcher.tsx`），项列表 = `["", ...Intl.supportedValuesOf("timeZone")]`；触发按钮显示当前选择（"" → t("settings.timezoneFollowBrowser")，否则显示 IANA 名称 + 当前 UTC 偏移如 `(UTC+08:00)`）。
  - `Intl.supportedValuesOf` 需 TS lib ES2022+；若项目 lib 较旧，用 `(Intl as any).supportedValuesOf?.("timeZone")` 并提供 fallback（浏览器 tz + "UTC"），运行时各主流浏览器均支持。
- 保存逻辑：`saveProfile` 中若 `timezone !== (props.user.timezone ?? "")` 则 body 加 `timezone`；成功后 `props.onUserUpdated(updated)` 走现有链路。

### i18n

- `web/src/i18n/locales/zh.ts` / `en.ts` 新增：`settings.timezone`（时区 / Timezone）、`settings.timezoneFollowBrowser`（跟随浏览器 / Follow browser）。

## 兼容与迁移

- 老库：migrate() ALTER 加列，NULL 兜底 → 行为与现状一致。
- 老客户端（若有）：PATCH body 无 timezone 字段时服务端不更新该列（`undefined` 跳过），完全向后兼容。
- 回滚：代码回滚即可，列留存无害。

## 权衡与决策记录

- **tz 仍是请求参数而非服务端读取 users.timezone**：改动面最小，且 spec（time-and-timezone.md）明确「Today is a request-time interval in the caller's IANA zone」。用户设置的时区只是前端发送值的来源。
- **清除时区用空字符串**：与 displayName 的 `"" → null` 模式一致（account.ts:40）。
- **不改 web/src/format.ts 的 browserTz**：保留函数作为兜底来源，format 层其余逻辑不动。

## 风险

- `Intl.supportedValuesOf` 的 TS 类型：engines 要求 node>=22，TS lib 需 ≥ ES2022.Intl；typecheck 若报错用局部类型断言。
- 切换时区瞬间运行中的计时条目：tz 变化导致窗口重拉，运行条目按新 tz 的今日窗口 clip，与既有 date 切换行为一致，无新增风险。
