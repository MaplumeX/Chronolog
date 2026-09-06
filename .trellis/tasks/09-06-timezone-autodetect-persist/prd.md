# Persist detected browser timezone as user default

## Goal

将时区默认值从「NULL = 动态跟随浏览器」改为业界主流的**检测后持久化**模式（Calendly/Clockify 风格）：用户首次访问时，前端检测到的浏览器 IANA 时区被自动保存到 `users.timezone`，此后所有展示使用保存值；用户仍可随时在设置中手动修改。

## Background（已确认事实）

- 现状（task 09-06-settings-timezone）：`users.timezone` 可空，NULL = 跟随浏览器；`App.tsx:62` `tz = user?.timezone ?? browserTz()`。
- 设置页 Profile 卡片时区下拉含「跟随浏览器」项（值 ""，提交后服务端置 NULL）。
- `PATCH /api/profile` 已接受 `timezone` 字段（IANA 校验、空串置 NULL）。
- 业界调研（上一轮 web research）：Calendly/Clockify 注册时检测并持久化；Toggl 双轨制导致用户困惑（官方 KB 有专文解释偏移问题）；NN/g 建议自动检测替用户定位。

## Requirements

### R1 首次访问自动持久化检测时区

- 登录态下（`api.me()` 或登录成功后）若 `user.timezone === null`，前端调用 `PATCH /api/profile { timezone: browserTz() }` 持久化检测值。
- 持久化前 UI 不等待：本地立即以 `browserTz()` 生效（与现状行为一致，无闪变）。
- 失败静默（fire-and-forget），下次访问重试；不阻塞任何页面渲染。
- 老用户（已有 timezone）不受影响；用户手动改过的时区永不被自动覆盖。

### R2 设置页 UI 调整

- **移除「跟随浏览器」选项**（用户决策 Q1）：下拉只含 IANA 时区列表。
- `user.timezone === null`（瞬态：首次访问且自动持久化尚未完成）时，下拉默认选中 `browserTz()`，正常走差异提交。
- 用户想恢复浏览器时区：直接在下拉中选中浏览器当前时区（效果等同）。

### R3 语义澄清

- `users.timezone = NULL` 的含义从「用户选择跟随浏览器」变为「尚未检测/持久化」（瞬态，仅在首次访问与检测失败时存在）。
- 服务端 `PATCH /api/profile` 的空串清除路径保持不变（API 级能力，前端不再使用）。

### R4 技术要点（轻量任务，并入 PRD）

- `App.tsx`：user 加载/登录成功后，若 `user.timezone === null`，fire-and-forget 调 `api.updateProfile({ timezone: browserTz() })`，成功后 `setUser` 更新（设置页与各视图随之一致）；失败静默。按 user id 去重，避免 me() 与登录路径重复触发。
- UI 不等待持久化：`tz = user?.timezone ?? browserTz()` 保持不变，NULL 期间即用检测值。
- i18n：删除 `settings.timezoneFollowBrowser`（zh + en，en 由 zh key 类型约束）。
- 服务端无改动；现有 server 测试不动。

## Acceptance Criteria

- [ ] 新注册/未设置时区的用户登录后，`users.timezone` 被自动写入浏览器时区（无需打开设置页）。
- [ ] 写入前 UI 已按检测时区正常工作，无错乱或等待。
- [ ] 用户手动设置 `America/New_York` 后，更换浏览器/设备登录不再被自动覆盖（持久值优先，仅 NULL 才触发检测）。
- [ ] 检测保存失败（网络错误）不报错、不阻塞，下次登录重试。
- [ ] `npm run typecheck` 与 `npm test` 通过。

## Out of Scope

- 服务端基于 IP/请求头的时区推断（不可靠，前端检测为准）。
- 与浏览器时区不一致时的提醒（另行考虑）。
- 下拉搜索/城市标签等选择器 UX 改进（另行考虑）。

