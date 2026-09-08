# 执行计划：无间隙计时

## 实施顺序

### Step 1: 后端 — DB 与用户设置

- [ ] `server/src/db.ts`：`SCHEMA_SQL` users 表加 `continuous_timing INTEGER NOT NULL DEFAULT 0`；`migrate()` 加幂等 ALTER（沿用 timezone 先例 `db.ts:122-126`）。
- [ ] `server/src/schema.ts`：users 表加 `continuousTiming: integer(..., { mode: "boolean" }).notNull().default(false)`。
- [ ] `server/src/auth.ts` + `server/src/routes/auth.ts`：requireUser / register / login / me 响应带 `continuousTiming: Boolean(...)`。
- [ ] `server/src/routes/account.ts`：PATCH /api/profile 接受 `continuousTiming?: boolean`（zod `z.boolean().optional()`，加入 refine 至少一字段判断），响应带该字段。
- 验证：`npm run typecheck -w server`。

### Step 2: 后端 — stop 接口无间隙逻辑

- [ ] `server/src/routes/timer.ts` `/api/timer/stop`：改为事务；停止旧段后读用户 `continuous_timing`，开启则 insert 新段（categoryId null、description ""、startedAt=同一 nowIso），响应 entry = 新段；关闭则保持现状响应（刚停止的段）。无运行中计时仍 409（事务内抛出）。
- [ ] 测试 `server/test/timer.test.ts` 新增：
  - 关闭模式：stop 后无运行条目，返回段 stoppedAt 非 null（AC3）。
  - 开启模式：stop 后 `GET /api/timer/current` 返回新段；新段 categoryId null、categoryName "未分类"、description 空、tags 空；旧段 stoppedAt === 新段 startedAt（AC2）。
  - 开启模式无运行计时：409（AC4）。
  - 关闭开关后（PATCH profile）stop 回到完全停止（AC6）。
  - 开启模式下新段可直接 `PATCH /api/timer/current` 换分类（衔接 R2）。
- 验证：`npm test -w server`。

### Step 3: 前端 — API 与设置页开关

- [ ] `web/src/api.ts`：`User` 加 `continuousTiming: boolean`；`updateProfile` body 加 `continuousTiming?: boolean`。
- [ ] 新建 `web/src/components/ui/switch.tsx`（radix switch 封装，风格对齐现有 ui 组件；确认依赖 `@radix-ui/react-switch` 是否需安装）。
- [ ] `web/src/pages/SettingsPage.tsx`：资料卡时区行之后加开关行 + 说明文案；纳入差异提交与保存按钮 disabled 逻辑。
- [ ] i18n `zh.ts` / `en.ts`：`settings.continuousTiming`、`settings.continuousTimingHint`。
- 验证：`npm run typecheck -w web`。

### Step 4: 前端 — 停止换段与分类选择器自动弹出

- [ ] `web/src/hooks/use-timer-controller.tsx` `onToggle`：停止分支改为 `const { entry } = await api.stop(); props.onCurrent(entry.stoppedAt === null ? entry : null)`；换段成功（entry.stoppedAt === null）时触发分类选择器自动打开。
- [ ] `web/src/components/CategoryPicker.tsx`：加可选受控 `open` / `onOpenChange` props 透传 DropdownMenu Root。
- [ ] TimerBar / useTimerController 连接受控 open；用户选分类走已有 `onRunningCategoryChange`，关闭或选中后复位自动打开标记。
- [ ] 测试：useTimerController 停止分支两模式的行为（如有 hook 层测试基建；参照现有 App.test.tsx / 组件测试模式）。
- 验证：`npm test -w web`。

### Step 5: 全量验证

- [ ] `npm run typecheck && npm test`（两个 workspace）。
- [ ] 手动验收（dev server）：AC1–AC6 逐条走查，重点 AC2 时间戳相接、AC5 弹出选择器。

## 验证命令

```bash
npm run typecheck          # server + web
npm test                   # server + web
npm run dev                # 手动验收
```

## 风险文件与回滚点

- 高风险：`server/src/routes/timer.ts`（stop 事务化）、`web/src/hooks/use-timer-controller.tsx`（停止分支语义）。
- 公共组件：`CategoryPicker.tsx`（受控 props，需回归分类页/表单用例）。
- 回滚：单 commit revert；DB 列带默认值无破坏。

## task.py start 前检查

- [ ] prd.md / design.md / implement.md 齐备且经用户审阅。
- [ ] implement.jsonl / check.jsonl 已填真实条目（非 _example）。
