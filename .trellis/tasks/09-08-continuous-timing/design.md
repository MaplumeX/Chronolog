# 技术设计：无间隙计时

## 1. 架构与边界

三层改动，自底向上：

1. **数据层**：`users` 表新增 `continuous_timing INTEGER NOT NULL DEFAULT 0`（SQLite 布尔惯例，0=关闭默认）。
2. **API 层**：
   - `PATCH /api/profile` 接受可选 `continuousTiming?: boolean`；`GET /api/auth/me`、login/register 响应、`PATCH /api/profile` 响应均含 `continuousTiming`。
   - `POST /api/timer/stop` 读取用户 `continuous_timing`，开启时在同一事务中停止旧段并创建新段。
3. **前端**：
   - `User` 类型加 `continuousTiming: boolean`；`api.updateProfile` body 加可选字段。
   - SettingsPage 账户 tab 资料卡新增开关行（保存走资料表单差异提交，与 timezone 同模式）。
   - `useTimerController.onToggle` 停止分支感知模式：响应里拿到新段时 `onCurrent(新段)` 并自动打开分类选择器。

## 2. 数据契约与 API 变更

### DB（`server/src/db.ts`）

- `SCHEMA_SQL` 的 `users` 表定义加 `continuous_timing INTEGER NOT NULL DEFAULT 0`。
- `migrate()` 加幂等列检查：`if (!userCols.includes("continuous_timing")) ALTER TABLE users ADD COLUMN continuous_timing INTEGER NOT NULL DEFAULT 0`（沿用 timezone 先例，`db.ts:122-126`）。
- `server/src/schema.ts` users 表加 `continuousTiming: integer("continuous_timing", { mode: "boolean" }).notNull().default(false)`。

### `POST /api/timer/stop`（`server/src/routes/timer.ts:180`）

开关关闭：行为逐字不变（现状代码路径）。

开关开启，改造后伪代码：

```ts
app.post("/api/timer/stop", async (req) => {
  const user = requireUser(req, deps);
  const nowIso = deps.now().toISOString();
  return deps.db.transaction((tx) => {
    const running = /* 同现状查询 */;
    if (!running) throw new AppError(409, "CONFLICT", "当前没有正在运行的计时");

    const u = tx.select({ continuousTiming: users.continuousTiming }).from(users)
      .where(eq(users.id, user.id)).get();

    tx.update(timeEntries).set({ stoppedAt: nowIso }).where(eq(timeEntries.id, running.id)).run();

    if (!u?.continuousTiming) {
      return { entry: getEntry(deps.db, user.id, running.id, deps.now()) };
    }
    const newId = newId_();
    tx.insert(timeEntries).values({
      id: newId, userId: user.id, categoryId: null,
      description: "", startedAt: nowIso, stoppedAt: null,
    }).run();
    return { entry: getEntry(deps.db, user.id, newId, deps.now()) };
  });
});
```

要点：

- **同一事务、同一 `nowIso`**：前段 stoppedAt = 新段 startedAt 严格相等，无间隙不变量由服务端保证。
- **响应 entry = 新段**（运行中）。这是前端区分"完全停止"与"换段"的唯一信号：`entry.stoppedAt === null` → 换段成功仍有计时在跑；`entry.stoppedAt !== null` → 完全停止。
- 事务内调用 `getEntry` 传外层 `deps.db` 而非 tx 是既有模式（`startOnce` 未如此，但 stop 现状就在事务外调 getEntry）；若读取一致性有问题，改为事务内用 tx 查询——实现时以现有 `getEntry` 签名（接 `db`）为准，必要时在事务提交后再调 `getEntry`。
- 唯一索引冲突（`(user_id) WHERE stopped_at IS NULL`）：事务内先 update 旧段再 insert 新段，顺序保证不违反唯一约束；保留 `isUniqueViolation` 重试模式（沿 startOnce 先例）的评估留给实现，若无竞态窗口则不需要。

### `PATCH /api/profile`（`server/src/routes/account.ts`）

- body schema 加 `continuousTiming: z.boolean().optional()`；refine 条件加入该字段。
- updates 映射：`if (body.continuousTiming !== undefined) updates.continuousTiming = body.continuousTiming`。
- 响应 User 对象加 `continuousTiming: Boolean(row.continuousTiming)`。

### User 序列化点（`server/src/auth.ts`、`routes/auth.ts`、`routes/account.ts`）

`requireUser`/`attachUser` 返回的 user 对象、register/login/me/profile 响应统一加 `continuousTiming: Boolean(...)`（SQLite integer → boolean）。

### 前端契约（`web/src/api.ts`）

- `User` 类型加 `continuousTiming: boolean`。
- `api.updateProfile` body 类型加 `continuousTiming?: boolean`。

## 3. 前端设计

### SettingsPage（`web/src/pages/SettingsPage.tsx`）

- 资料卡的时区下拉之后新增一行：`Label` + shadcn Switch（无 ui/switch.tsx，需新建 `web/src/components/ui/switch.tsx`，标准 radix `@radix-ui/react-switch` 包装，风格对齐现有 ui 组件）。
- 状态 `continuousTiming` 初始 `props.user.continuousTiming`；保存按钮 disabled 条件加入 `continuousTiming === props.user.continuousTiming` 判断；`saveProfile` 差异提交 `if (continuousTiming !== props.user.continuousTiming) body.continuousTiming = continuousTiming`。
- 开关旁给一行 `text-sm text-muted-foreground` 说明文案：开启后停止计时将自动开始下一段；完全停止需先关闭此开关（i18n key `settings.continuousTiming` / `settings.continuousTimingHint`）。

### useTimerController（`web/src/hooks/use-timer-controller.tsx`）

`onToggle` 停止分支：

```ts
if (running) {
  const { entry } = await api.stop();
  props.onCurrent(entry.stoppedAt === null ? entry : null);
}
```

- 后续的 today/week/boundary 刷新逻辑不变（新段已在跑，刷新会正确包含它）。
- `running?.id` 变化 effect 已会重置说明草稿，新段描述为空字符串，无需额外处理。
- 需要新增一个状态量（如 `categoryPickerAutoOpen`）或受控 CategoryPicker open：停止换段成功后自动打开分类选择器（AC5）。CategoryPicker 目前非受控（DropdownMenu 无 open prop 透传）；方案：给 CategoryPicker 加可选 `open`/`onOpenChange` 受控 props（透传给 DropdownMenu Root），TimerBar 层把受控开关传下去，useTimerController 在 stop 换段成功后置 true，用户选择分类或关闭下拉后置 false。
- 选择分类后走已有 `onRunningCategoryChange` → `api.updateCurrent`，新段从"未分类"变为所选分类。

### i18n（`web/src/i18n/locales/zh.ts` / `en.ts`）

新增 key：`settings.continuousTiming`（无间隙计时）、`settings.continuousTimingHint`、（如需）`timer.uncategorizedRunning`。

## 4. 兼容性

- 老库迁移：幂等 ALTER + DEFAULT 0，既有用户行为不变（开关默认关闭，stop 行为不变）。
- API 消费方：响应新增 `continuousTiming` 字段是加法变更；`stop` 响应结构不变（仍是 `{ entry }`），仅 entry 语义在开关开启时不同（新段运行中）——对脚本类消费方是行为变化，发布说明提及。
- 前端旧会话：刷新后 `me` 接口带回开关状态，无需迁移。

## 5. 权衡与风险

- **AC5 受控下拉的实现成本**：radix DropdownMenu 受控 open 需透传 props，改动小但触碰 CategoryPicker 公共组件；备选方案是不自动弹出、仅视觉高亮引导（留 fallback）。
- **响应语义**：stop 响应 entry 从"刚停止的段"变为"新段"，前端必须靠 `stoppedAt === null` 分支处理；测试覆盖两种模式。
- **同秒边界**：跨天停止时新段 startedAt = 旧段 stoppedAt，Timeline 的 cross-day 渲染已按 clipRangeMs 处理，无额外工作。

## 6. 回滚

- 单 commit 交付；回滚 = revert commit。DB 新增列带默认值，revert 代码后老代码不读该列，无破坏。
