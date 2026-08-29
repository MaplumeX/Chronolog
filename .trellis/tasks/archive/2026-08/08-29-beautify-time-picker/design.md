# Design — Beautify time picker in entry editor

## 组件边界

新建 `web/src/components/DateTimePicker.tsx`（受控组件）：

```tsx
DateTimePicker(props: {
  id?: string;
  value: string;              // "YYYY-MM-DDTHH:mm:ss"（本地时区，与现契约一致）
  onChange: (v: string) => void;
  disabled?: boolean;
})
```

- 不引入新依赖，仅复用现有 `ui/popover.tsx`、`ui/calendar.tsx`、`ui/button.tsx`、`ui/input.tsx` 及 lucide 图标。
- EntryEditor 中的两个 `datetime-local` Input 替换为 `<DateTimePicker />`，`Label` 的 `htmlFor` 移到 Popover 触发按钮上（label ↔ trigger 关联）。

## 交互结构

Popover 弹层内垂直两段：

1. **日期段**：`ui/calendar.tsx`（`mode="single"`），locale 按 `i18n.language`（`zhCN` / `enUS`，同 DateNav）。选中某天 → 更新 value 的日期部分，时间部分保持不变，弹层不关闭（时间可能还要调）。
2. **时间段**：`HH : MM : SS` 三段数字输入（时间步进控件）。

### 时间步进控件（TimeField）

- 每段为一个无边框 `input`（`inputmode="numeric"`，宽 2ch，居中，mono + `tabular-nums`），段间以 `:` 分隔。
- 键盘行为：
  - 直接键入数字（自动补零，失焦/输入完成时规范化：时 ≤ 23、分/秒 ≤ 59，越界 clamp）。
  - `ArrowUp` / `ArrowDown`：±1；`Shift+Arrow`：±10（时同理在 0–23 环绕）。
  - `Backspace` 清空当前段。
  - 段间 `ArrowLeft` / `ArrowRight` / 输入满 2 位自动跳到下一段。
- 附加小型步进按钮（上下 chevron）放每段右侧？——**不放**：视觉噪音大；纯键盘 + 直接键入已覆盖。弹层底部提供「现在」快捷按钮（`entry.now`，把该字段设为当前时刻）。
- 弹层宽度 `w-auto`，Calendar 自然宽度；时间段用 `border-t` 分隔（符合 shell 指南的分组方式）。

### 触发按钮

- 样式对齐 CategoryPicker 触发器：`variant="outline"`、`rounded-lg`、`w-full justify-start`。
- 内容：lucide `CalendarClock` 图标 + 两行文本（上行日期 `M月d日 周X` / `Mar 12, Wed`，下行 mono `tabular-nums` 时刻 `14:30:00`）——或单行日期+时间。取**单行**：`3月12日 周三 14:30:00`，避免触发器过高；mono 用于时间部分。
- 无外部 label 时有 `aria-label`（沿用 Label 关联即可）。

## 数据流

- 内部把 value 拆为 `{ date: Date, h, m, s }`；任何段变更后重组为 `YYYY-MM-DDTHH:mm:ss` 上抛 `onChange`。
- 空/非法输入处理：TimeField 段允许空串（输入中状态），但组件在 blur 时规范化；若 value 仍非法（不会发生于受控初始值合法的场景），Date.parse 已有 NaN 分支兜底（EntryEditor 现有逻辑）。
- EntryEditor 的 `startedAt` / `stoppedAt` state 与 `toLocalInput` 不变，duration 计算与保存路径零改动。

## 主题与样式

- 全部消费语义 token（`bg-popover`、`border-border`、`text-muted-foreground`…），无裸色值，light/dark 自动适配。
- Calendar 已带 selected/today 样式，无需定制。

## i18n

新增键（zh/en 同步）：
- `entry.now`：「现在」/ "Now"
- `entry.pickTime`（如需 aria）：跟随现有 Label 键即可，不新增冗余键。

## 兼容与回滚

- 纯前端组件替换，无数据迁移；回滚 = revert 单个 commit。
- 风险点：TimeField 的键盘环绕/跳段逻辑复杂度集中在 `TimeField.tsx`（与 DateTimePicker 同文件或独立小文件），单独可测。
