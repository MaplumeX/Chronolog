# Implement: Add timezone setting with global date/time display

## 执行清单（按序）

### Step 1: 服务端 — schema 与迁移

- [ ] `server/src/schema.ts`：users 表加 `timezone: text("timezone")`。
- [ ] `server/src/db.ts`：SCHEMA_SQL users 建表加 `timezone TEXT`；`migrate()` 加幂等 ALTER（参考 display_name，db.ts:120-122）。

### Step 2: 服务端 — API

- [ ] `server/src/auth.ts`：`AuthUser` 加 `timezone: string | null`；`loadUser` 两个分支返回 `timezone: row.timezone ?? null`。
- [ ] `server/src/routes/auth.ts`：login 响应加 `timezone`（me 端点返回 loadUser 结果，自动带上）。
- [ ] `server/src/routes/account.ts`：profileBody 加 `timezone` 可选字段（max 64）；refine 至少一字段含 timezone；非空值用 `IANAZone.isValidZone` 校验（无效 400 VALIDATION「时区无效」）；空串存 null；updates/响应带 timezone。

### Step 3: 服务端 — 测试

- [ ] `server/test/`（profile 相关测试文件）：新增用例——设置有效时区成功持久化并返回；无效时区 400；空字符串清除为 null；老库迁移后 me 返回 null 不报错（如现有迁移测试模式）。
- [ ] 运行 `npm test -w server` 通过。

### Step 4: 前端 — API 类型与时区来源

- [ ] `web/src/api.ts`：`User` 加 `timezone: string | null`；`updateProfile` body 加 `timezone?: string`。
- [ ] `web/src/App.tsx`：派生 `const tz = user?.timezone ?? browserTz()`，传给 `useTimerController`、`StatsPage`、`GoalsPage`。
- [ ] `web/src/hooks/use-timer-controller.tsx`：props 加 `tz`，删 `browserTz()`；refresh effect 依赖加 tz。
- [ ] `web/src/pages/StatsPage.tsx` / `GoalsPage.tsx`：props 加 `tz`，删内部 `browserTz()`；数据拉取 effect 依赖含 tz。

### Step 5: 前端 — Settings UI 与 i18n

- [ ] `web/src/i18n/locales/zh.ts`、`en.ts`：加 `settings.timezone`、`settings.timezoneFollowBrowser`。
- [ ] `web/src/pages/SettingsPage.tsx`：Profile 卡片加时区下拉（dropdown-menu 模式，参考 LanguageSwitcher）；显示 IANA 名 + UTC 偏移；「跟随浏览器」= ""；保存时差异提交 timezone；成功走 `onUserUpdated`。
- [ ] `web/src/i18n/i18next.d.ts` 如有 key 类型约束则同步。

### Step 6: 前端 — 测试

- [ ] 时区列表/偏移格式化的纯函数（若抽出到 format.ts）加单测；SettingsPage 或相关 hook 测试按现有模式补充。
- [ ] 运行 `npm test -w web` 通过。

### Step 7: 全量验证

- [ ] `npm run typecheck`
- [ ] `npm test`（server + web）

## 验证命令

```bash
npm run typecheck
npm test
```

## 风险文件与回滚点

- `server/src/db.ts` migrate：幂等 ALTER，回滚安全（列留存无害）。
- `web/src/hooks/use-timer-controller.tsx` refresh 依赖变化：注意避免无限循环（tz 来自 props，仅 user 更新时变化）。
- 提交按 server / web 可分两个 commit 或合一，feature 提交。

## Start 前检查

- [ ] implement.jsonl / check.jsonl 已填真实 spec 条目
- [ ] prd.md 收敛（无 Open Questions）
- [ ] 用户已批准最终规划摘要
