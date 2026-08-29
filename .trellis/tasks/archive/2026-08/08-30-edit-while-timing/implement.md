# Implement: Allow editing running timer's description, category and tags

## 执行清单（按序）

### Step 1: 后端 `PATCH /api/timer/current`

- [ ] `server/src/routes/timer.ts`：新增 `updateBody` zod schema（description/categoryId/tagIds 全 optional）与 `updateRunningOnce` 事务函数；注册 `app.patch("/api/timer/current")`，无运行中计时返回 409。
- [ ] `server/test/timer.test.ts`：新增测试
  - 正常更新 description（trim）
  - 正常更新 categoryId + tagIds（返回 entry 含新 tags）
  - 409：无运行计时
  - 400：description > 200
  - 404：他人 categoryId / tagIds
  - startedAt 字段被 zod strict 拒绝（多余字段）

### Step 2: 前端 API client

- [ ] `web/src/api.ts`：新增 `api.updateCurrent(body)`。

### Step 3: 前端计时中编辑（use-timer-controller.tsx）

- [ ] 新增 `runningDraft` 本地 state + 防抖（600ms）说明保存；`running` 变为 null 时清空 draft 并取消 pending 防抖。
- [ ] 计时中分类/标签 onChange → 立即 `api.updateCurrent` → 成功 `props.onCurrent(entry)` + 分类变更时刷新 today/week（复用 refreshEntries）。
- [ ] `barProps`：去掉 `descriptionReadOnly`（或恒 false）；CategoryPicker/TagPicker 计时中不再 disabled，value 切换为 running 的值。
- [ ] 失败路径 `setError`。
- [ ] `web/src/components/TimerBar.tsx`：移除 `descriptionReadOnly` prop（若 controller 不再需要）。

### Step 4: 验证

- [ ] `npm test -w server`
- [ ] `npm run typecheck`
- [ ] 手动/浏览器验证 AC1–AC7（dev 起服务）

## 验证命令

```bash
npm test -w server
npm run typecheck
npm run dev   # 手动验证
```

## 风险与回滚

- 风险文件：`use-timer-controller.tsx`（状态切换复杂度：计时中 vs 空闲两套表单值来源）。
- 防抖期间停止计时需取消 pending 更新，避免 409 错误弹出。
- 回滚点：整任务单 commit，revert 即可。
