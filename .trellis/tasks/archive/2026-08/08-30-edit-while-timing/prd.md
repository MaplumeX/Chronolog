# Allow editing running timer's description, category and tags

## Goal

计时运行期间，用户可以直接在 TimerBar 顶栏编辑当前正在计时的条目的说明、分类和标签，无需先停止再修改。对齐 Toggl Track 的行为。

## Background / Confirmed Facts

- 现状：计时中 TimerBar 的说明输入框 `readOnly`、CategoryPicker/TagPicker `disabled`（`web/src/hooks/use-timer-controller.tsx` 中 `descriptionReadOnly: Boolean(running)`、`disabled: Boolean(running)`）。
- 后端已存在 `PATCH /api/entries/:id`（`server/src/routes/entries.ts:149`），但 `updateOnce` 明确拒绝运行中条目：`if (!entry.stoppedAt) throw new AppError(409, "CONFLICT", "运行中的条目不可编辑")`（entries.ts:135），且该接口要求 `startedAt`/`stoppedAt` 全量字段。
- `server/src/routes/timer.ts` 已有 `/api/timer/current`、`/api/timer/start`、`/api/timer/stop`，`startOnce` 内含分类/标签归属校验逻辑可参考。
- 运行中条目通过 `props.onCurrent(entry)` 全局持有（App 层 state），TimerBar 展示 `running.description` / `running.tags`。
- 前端暂无 debounce 工具；`use-timer-controller.tsx` 是唯一允许的业务 hook（spec: frontend/hook-guidelines.md）。

## Requirements

- R1: 计时中说明输入框可编辑，输入停止后（防抖约 600ms）自动保存到服务端。
- R2: 计时中可切换分类和标签，变更即时（无防抖）保存到服务端。
- R3: 后端提供更新运行中条目的接口，仅接受 `description` / `categoryId` / `tagIds`，不允许修改 `startedAt`（运行中条目无 `stoppedAt`）。
- R4: 校验：说明 trim 后 ≤200 字符；分类、标签必须属于当前用户；无运行中计时时返回 409 CONFLICT。
- R5: 保存失败时在 TimerBar 的 error 区域展示错误信息（复用现有 error 展示）。
- R6: 修改分类后，TimerBar 分类胶囊与 Timeline 色块颜色随之更新（刷新 today/week 数据）。
- R7: 停止计时后表单回到"新计时"初始状态，不残留被编辑过的运行中字段值。

## Acceptance Criteria

- [ ] AC1: 计时中在输入框修改说明，停顿 ~600ms 后刷新页面，说明已保存（R1）。
- [ ] AC2: 计时中切换分类，Timeline 中该运行条目色块颜色立即更新（R2/R6）。
- [ ] AC3: 计时中修改标签，运行标签胶囊展示更新后的标签（R2）。
- [ ] AC4: 无运行计时调用更新接口返回 409；说明 >200 字符返回 400；他人分类/标签 id 返回 404（R4）。
- [ ] AC5: 更新接口不允许修改 startedAt（接口不接受该字段，schema 拒绝）（R3）。
- [ ] AC6: 保存失败（如网络错误）时 TimerBar 显示错误提示（R5）。
- [ ] AC7: 停止计时后输入框回到"新计时"状态，之前编辑的运行说明不会成为下一条计时的默认值（R7）。
- [ ] AC8: 服务器测试覆盖 R4 的错误路径与正常更新路径。

## Out of Scope

- 运行中条目修改开始时间（涉及 Timeline 拖拽/时间编辑，复杂度高，不在本次范围）。
- `PATCH /api/entries/:id` 对运行中条目的解禁（保持"已停止条目走 entries 接口、运行中条目走 timer 接口"的边界）。
- 多标签页实时同步（另一标签页编辑后本页刷新才可见）。

## Open Questions

（无）
