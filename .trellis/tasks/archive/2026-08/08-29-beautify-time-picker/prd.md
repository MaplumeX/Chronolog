# Beautify time picker in entry editor

## Goal

美化条目编辑器（EntryEditor）中的时间选择组件，使其与项目现有的 teal 冷色双主题设计系统及 CategoryPicker / TagPicker 风格统一，替代原生 `<input type="datetime-local">` 的不一致外观。

## Background / Confirmed Facts

- `web/src/components/EntryEditor.tsx:120-139`：开始/结束时间当前使用两个原生 `<input type="datetime-local" step={1}>`，值格式为 `YYYY-MM-DDTHH:mm:ss`（本地时区，见 `toLocalInput`）。
- 项目已有 shadcn 风格 `ui/` 组件：`popover.tsx`、`calendar.tsx`（react-day-picker v10）、`button.tsx`、`input.tsx`、`label.tsx` 等，基于 radix-ui + tailwindcss v4。
- 编辑器在 Dialog 中使用（`entry.edit` / `entry.create`），已有 duration 实时计算与 OVERLAP 错误展示。
- i18n：zh / en 两个 locale，已有 `entry.startTime` / `entry.endTime` 键。

## Requirements

- 新建自定义 DateTimePicker 组件（或组合式 Popover + Calendar + 时间输入），用于替换 EntryEditor 中的两个 datetime-local 输入。
- 日期选择使用现有 `ui/calendar.tsx`（react-day-picker），时间部分（时/分/秒）采用与整体风格统一的输入控件（具体交互形态在 design.md 中定）。
- 保持现有数据流不变：value 仍为 `YYYY-MM-DDTHH:mm:ss` 本地时间字符串，onChange 上抛同格式值；秒级 step 保留。
- 支持浅色/深色双主题，与现有设计系统 token（teal 冷色调）一致。
- 键盘可达性：可通过键盘完成日期与时间的调整。
- i18n：新增 UI 文案需提供 zh / en 两种语言。

## Acceptance Criteria

- [ ] EntryEditor 中开始/结束时间不再使用原生 datetime-local，替换为自定义组件。
- [ ] 新组件在浅色与深色主题下外观协调，与 CategoryPicker / TagPicker 风格一致。
- [ ] 选择/输入时间后，duration 计算与保存流程行为与改动前一致（含秒）。
- [ ] 键盘用户可以完成完整的日期时间选择。
- [ ] `npm run typecheck` 与 `npm run build` 通过。
- [ ] zh / en 文案齐全，无硬编码中文/英文字符串。

## Out of Scope

- 不改动后端 API 与时间存储格式。
- 不改动时间轴（Timeline）拖拽创建草稿的逻辑。
- 不引入新的重量级日期库（沿用 dayjs/date-fns 之外的现有依赖；如需要轻量工具优先手写）。

## Technical Notes

- 时间交互形态已确认：**数字输入 + 上下箭头步进**（时/分/秒三段，可直接键入）。
- 弹层结构参考 DateNav 的 Popover + Calendar 模式；DateNav 已示范 `i18n.language === "zh" ? zhCN : enUS` 的 locale 注入。
- 组件消费语义 token class（不写裸色值），mono 字体 + `tabular-nums` 用于时刻数字（见 design-tokens.md）。
- i18n 键必须 zh / en 同步（`en` 类型为 `Record<keyof typeof zh, string>`）。
