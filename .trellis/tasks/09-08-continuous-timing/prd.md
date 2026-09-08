# 无间隙计时：停止后自动开始下一段

## Goal

用户停止当前计时段后，系统自动以相同时间点开始下一段计时，两段之间没有间隙（前一段 stoppedAt = 下一段 startedAt）。适合持续记录整天时间、不想漏掉间隔的用户。

## 已确认事实（代码证据）

- 后端 `POST /api/timer/stop`（`server/src/routes/timer.ts:180`）：无 body，将运行中条目 stoppedAt 置为 now，409 if 无运行中计时。
- `startOnce`（`server/src/routes/timer.ts:110`）：start 时若已有运行中条目会先停止旧的再创建新的（已是原子事务），说明"停止旧+开始新"的模式已有先例。
- 前端 `useTimerController.onToggle`（`web/src/hooks/use-timer-controller.tsx:210`）：running 时点按钮调 `api.stop()`，否则 `api.start()`。停止和开始是两次独立请求，中间存在网络间隙。
- 计时中 TimerBar 的说明/分类/标签可编辑，直接 PATCH 到运行中条目（08-30-edit-while-timing）；说明有 600ms 防抖。
- 用户设置目前存于 `users` 表（`timezone`、`display_name`，`server/src/db.ts:122-126` 有 ALTER TABLE 迁移先例），设置页 `web/src/pages/SettingsPage.tsx` 有 general/account 两个 tab。
- 主题/语言偏好是客户端 localStorage；timezone 是服务端账户设置。
- running 条目切换时（`running?.id` 变化），前端自动重置说明草稿。
- `time_entries.category_id` 已 nullable（08-31 category-archive）：NULL = 未分类，服务端 `entrySelect` 用 leftJoin + coalesce 显示"未分类"；运行中条目允许 categoryId 为 NULL。

## Requirements

### R1 无间隙模式开关（决策：方案 C）

- 开关位于设置页（SettingsPage）账户设置中，持久化到服务端 `users` 表（新增布尔字段，默认关闭）。
- 开启后：`POST /api/timer/stop` 停止当前段的同时自动创建下一段（前段 stoppedAt = 新段 startedAt）。
- 关闭后：stop 行为与现状一致。
- 不放 TimerBar 快捷开关；跨设备同步（服务端设置）。

### R2 自动开始的新一段的初始内容（决策）

- 新一段：说明留空、标签留空、分类为 NULL（未分类）。
- 停止后前端自动弹出/聚焦分类选择器，引导用户立刻选分类；用户不选则新段保持"未分类"（合法状态，08-31 已支持 categoryId nullable，服务端 coalesce 为"未分类"）。
- 分类/标签/说明随时可在运行中编辑（已有能力）。

### R3 真正完全停止的方式（决策：方案 A）

- 开启无间隙模式后，点停止按钮始终等于"结束当前段 + 自动开始下一段"。
- 要完全停止：去设置页关闭无间隙开关，回到计时页点停止（此时行为与现状一致）。
- 不提供长按/右键/下拉等额外出口；设置页开关是唯一退出方式。

### R4 行为细则

- 开关关闭（默认）：`POST /api/timer/stop` 行为与现状完全一致，不创建新段。
- 开关开启：`POST /api/timer/stop` 在同一事务中：旧段 stoppedAt = now；新段 startedAt = 同一 now，说明空、标签空、分类 NULL；返回新段（运行中）作为响应的 entry。
- 开关开启但当前无运行中计时：与现状一致返回 409，不创建任何条目。
- 在设置页关闭开关不影响正在运行的条目（只改后续 stop 行为）。

## Acceptance Criteria

- [ ] AC1: 设置页账户设置区出现无间隙计时开关，默认关闭，保存后跨设备生效（服务端持久化）。
- [ ] AC2: 开关开启时点停止：旧段结束、新段立刻开始（两段时间戳无缝相接），新段说明/标签为空、分类为"未分类"，计时继续运行（R1、R2、R4）。
- [ ] AC3: 开关关闭时点停止：行为与现状完全一致（完全停止，不新建条目）（R4）。
- [ ] AC4: 无运行中计时时点停止：两种模式下都返回 409（R4）。
- [ ] AC5: 停止换段后前端弹出分类选择器供用户选择；不选则保持未分类，计时不受影响（R2）。
- [ ] AC6: 设置页关闭开关后，后续停止回到完全停止行为；关闭动作本身不影响正在运行的条目（R3、R4）。

## Out of Scope

- 间隔补录/gap 插槽（已有 boundary/gap 功能）。
- 长按/右键/下拉等快捷完全停止出口（方案 B/C，已被否决）。
- TimerBar 上的快捷开关。

## 已解决的决策

- 开关位置：方案 C，仅设置页持久化开关（用户 2026-09-08 决策）。
- 新段初始内容：说明/标签留空，分类 NULL 未分类，停止后弹出分类选择器引导选择；不选则保持未分类（用户 2026-09-08 决策）。
- 完全停止方式：方案 A，设置页关闭开关后停止；不提供其他出口（用户 2026-09-08 决策）。
