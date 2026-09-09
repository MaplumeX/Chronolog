# 执行计划：紧凑行内时间编辑组件（方向 C）

前置：`prd.md`（R1–R8 / AC1–AC9）、`design.md`（组件边界与契约）已定稿。

## 实施步骤（有序）

### Step 1 — 新组件 `EntryTimeRangeEditor`
- [ ] 新建 `web/src/components/EntryTimeRangeEditor.tsx`：
  - 紧凑行三槽位（开始 → 结束 · 时长），跨天副行（R1/R3）。
  - 展开面板：start/end（time input + DateAdjust calendar popover）、duration（输入 + 15/30/60/90 快捷键 + 「到现在」，以开始为锚反推结束）（R2）。
  - 受控 props（`startedAt`/`stoppedAt`/`onStartChange`/`onStopChange`），格式契约 `"YYYY-MM-DDTHH:mm:ss"`。
  - `parseDurationInput` 纯函数导出；非法输入不落地（R6）。
  - 无「现在」按钮（OQ2 决策）。
- [ ] 新建 `web/src/components/EntryTimeRangeEditor.test.tsx`：
  - `parseDurationInput` 全分支（`1:30:00`/`1:30`/`90m`/`1.5h`/`45s`/非法串）。
  - 组件交互（遵循 quality-guidelines：jsdom + userEvent + i18n pin en）：槽位展开/收起、time input 提交、时长反推结束、「到现在」、跨天副行、非法时长不破坏状态。
- 验证：`npm test -w web -- EntryTimeRangeEditor` 通过。

### Step 2 — 接线 `EntryEditor` + i18n
- [ ] `EntryEditor.tsx`：替换两个 `DateTimePicker` 块 + 只读时长行为单个 `<EntryTimeRangeEditor />`。
- [ ] `onSave` 增加 end ≤ start 硬校验（AC5，文案 `entry.invalidRange`，参照现有 `entry.invalidTime` 分支写法）。
- [ ] `zh.ts` / `en.ts` 新增 design.md 草案的 i18n key（zh/en 同步，`en` 有 Record 类型约束兜底）。
- 验证：`npm run typecheck -w web`、`npm test -w web` 全绿。

### Step 3 — 清理
- [ ] 删除 `web/src/components/DateTimePicker.tsx`（R8；先确认无引用）。
- [ ] 删除 `entry.now` i18n key（唯一使用方为 DateTimePicker「现在」按钮）。
- [ ] 删除 demo：`web/demo.html`、`web/src/demo/`（AC9）。
- 验证：`grep -rn "DateTimePicker\|entry.now" web/src` 无残留；typecheck + test 全绿。

### Step 4 — 人工检查（quality-guidelines 手动清单）
- [ ] 编辑已有条目：三槽位展开/收起、时长快捷键反推、跨天副行、AC5 报错提示可见。
- [ ] 新建草稿（拖拽/空隙）：初值为拖拽时间。
- [ ] zh/en 切换文案正确；深浅主题下紧凑行可读。
- [ ] w-80 popover 内布局完整不溢出。

## 验证命令

```bash
npm run typecheck -w web
npm test -w web
npm run build -w web
```

## 风险与回滚点

| 风险 | 缓解 |
|---|---|
| w-80（320px）内三槽位 + 副行挤压 | Step 1 用 demo C 已验证的紧凑布局（flex + 小字号 + truncate）；Step 4 人工确认 |
| 删除 `DateTimePicker` 漏引用 | Step 3 先 grep 再删，typecheck 兜底 |
| 时长输入边界（0 / 超大值） | `parseDurationInput` 单测覆盖；0 合法（瞬时条目）、负数/NaN 拒绝 |

每步独立可 commit，revert 单步不影响其余（组件未接线前无产品影响）。
