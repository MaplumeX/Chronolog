# Design: Allow editing running timer's description, category and tags

## 总体方案

新增 `PATCH /api/timer/current`（timer.ts，与 entries.ts 的 `PATCH /api/entries/:id` 保持边界：已停止条目走 entries，运行中条目走 timer）。前端在 `use-timer-controller.tsx` 中：计时中说明/分类/标签变更时调用新接口保存，并同步更新 `props.onCurrent(entry)` 使顶栏与 Timeline 立即反映；分类变更后刷新 today/week（颜色）。

## 后端

### 路由：`PATCH /api/timer/current`（server/src/routes/timer.ts）

请求体（zod `partial` 风格但实现为全字段 optional）：

```ts
const updateBody = z.object({
  description: z.string().max(200, "说明过长").optional(),
  categoryId: z.string().min(1).optional(),
  tagIds: z.array(z.string().min(1)).optional(),
});
```

处理流程（单事务 `updateRunningOnce`）：

1. `requireUser`
2. 查 running（userId + stoppedAt IS NULL），无则 `AppError(409, "CONFLICT", "当前没有正在运行的计时")`（复用 stop 的文案）
3. 若传 `categoryId`：校验归属（同 startOnce 逻辑）
4. 若传 `tagIds`：去重 + 校验归属（同 startOnce 逻辑）
5. 若传 `description`：trim（空串合法）
6. update timeEntries 相应列；若传 `tagIds`：delete + insert entryTags（同 entries.ts updateOnce 模式）
7. 返回 `{ entry: getEntry(...) }`（含 tags，前端直接用于 onCurrent）

注意：不更新 `startedAt`/`stoppedAt`；不做 overlap 检查（时间不变）。

### API client（web/src/api.ts）

```ts
updateCurrent: (body: { description?: string; categoryId?: string; tagIds?: string[] }) =>
  request<{ entry: TimeEntry }>("/api/timer/current", { method: "PATCH", body }),
```

## 前端（use-timer-controller.tsx）

计时中（`running` 非空）的编辑路径：

- **说明**：`onDescriptionChange` 更新本地 state（输入框 value 直接绑定 `running.description`），防抖 600ms 调 `api.updateCurrent({ description })`。用 `useRef` 存 timer id + 最新值，`useEffect` cleanup flush/取消。
- **分类**：`onChange` 立即调 `api.updateCurrent({ categoryId })`，成功后 `onCurrent(entry)` + 刷新 today/week（颜色变化）。
- **标签**：同分类，`api.updateCurrent({ tagIds })`，成功后 `onCurrent(entry)`。

关键状态设计：

- 计时中 TimerBar 的输入框 value 切换为本地受控 state `runningDraft`（初始 = `running.description`，`running.id` 变化时重置），避免直接改 `running` 对象。
- 分类/标签选择器在计时中改为可用：值来源直接用 `running.categoryId` / `running.tagIds`（非计时中仍用表单 state `categoryId`/`tagIds`）。
- `onToggle` 停止成功后清空 `runningDraft`。

停止后的新计时表单逻辑保持现状（`categoryId`/`description`/`tagIds` 表单 state）。

### 同步与错误

- 更新失败（ApiError/网络）→ `setError(msg)`（TimerBar 已展示 error）。
- 说明防抖期间停止计时：取消未发出的更新（clearTimeout），避免对已停止条目误调 timer 接口。

### 不变式

- `props.onCurrent(entry)` 持有的 entry 是顶栏/Timeline 的唯一真源，更新成功后以服务端返回的 entry 覆盖。

## 权衡

- **防抖 vs 失焦保存**：选防抖（600ms），Toggl 同款体验，用户无需显式确认。失焦保存需要管理焦点事件且切页面（SPA 内路由）不触发 blur。
- **复用 `PATCH /api/entries/:id` vs 新增 timer 接口**：entries 接口要求全量字段（含时间）且禁止运行中条目；为运行中条目开例外会混两条语义不同的编辑路径。新增专用接口更清晰，符合现有 timer.ts 职责划分。
- **说明空串**：合法（与 start 一致），允许清空说明。

## 兼容 / 回滚

- 纯新增接口 + 前端行为变化，无 schema 迁移。
- 回滚 = revert 单个 commit。
