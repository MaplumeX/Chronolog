# Replace entry time picker segment input

## Goal

把 `DateTimePicker` 弹层内的时/分/秒三段 stepper 输入（`TimeField`）替换为原生 `<input type="time" step={1}>`，解决当前时间输入的可用性问题。

## Background

当前弹层时间区是 `HH : MM : SS` 三个独立数字输入框（`web/src/components/DateTimePicker.tsx` 内的 `TimeField`），键盘契约复杂：键入满 2 位自动提交并跳下一段、第 3 位滚动替换、ArrowUp/Down ±1（Shift ±10）环绕、Backspace 清段、ArrowLeft/Right 跨段。实际使用中的问题：

- 键入 2 位立即提交并跳段，无法修正刚输入的值（如 `09` 想改 `08`，已跳到分钟段）。
- 分钟段想输入 `5x` 时，第一位 `5` 后补位时机不当会被提前提交。
- 小时 ArrowUp 在 23 时环绕到 00 但不进位日期，开始时间可能悄悄晚于结束时间。
- 整段选中后输入替换/追加的行为取决于光标态，偶发替换与追加混淆。

## Requirements

- 移除 `TimeField` 组件及其全部配套逻辑（`clampWrap`、`HOURS_MAX`/`MIN_SEC_MAX`、`focusIndex`/`shiftFocus`/`fieldRefs` 跨段导航）；这些无其它调用方，随本次一并删除。
- 弹层时间区改用单个原生 `<input type="time" step={1}>`（显示并编辑时/分/秒，秒不可丢）。
- `DateTimePicker` 的受控 value 契约不变：`"YYYY-MM-DDTHH:mm:ss"` 本地时间字符串。`<input type="time" step={1}>` 的 value 即 `HH:mm:ss`，直接拼/拆 `dateKey` 与时间部分即可（EntryEditor 的 `toLocalInput` / `Date.parse` 依赖该格式，不动）。
- 日历选日、月份导航、"现在" 快捷按钮、Popover 触发按钮的展示形态均保持不变。
- 非法/不完整输入不得写出非法 value：time input 空值（清空）时不调用 `onChange`（保持当前值），其余值由浏览器保证 `HH:mm:ss` 合法。
- 样式贴合现有语义 token 与双主题（class `.dark`）：用 Tailwind 类 + `color-scheme`（必要时 `::-webkit-*` 伪元素）定制原生控件外观，与弹层内其它元素风格一致。
- i18n：不新增文案键（time input 无本地化文案需求；aria-label 复用现有 `ariaLabel` prop）。

## Out of Scope

- 触发按钮展示格式、日历交互、"现在"按钮行为的任何改动。
- 12/24 小时制切换（原生控件跟随系统 locale，不做自定义）。
- EntryEditor 的时长计算与保存逻辑（依赖 value 契约不变，无需改动）。

## Acceptance Criteria

- [ ] 弹层内不再是三个独立 stepper 段输入，替换为单个 `type="time" step={1}` 输入框。
- [ ] 可以正确输入/编辑任意 `HH:mm:ss`（含 `09:05:03` 这类带前导零的值），由浏览器原生段交互处理，不存在"敲满 2 位被强制跳段"的自实现行为。
- [ ] 编辑开始/结束时间后，EntryEditor 的实时时长与保存结果正确（value 契约不变）。
- [ ] 日历选日后时间部分保留；"现在"按钮可用。
- [ ] 清空时间输入不产生非法 value（保持当前值或拒绝写入）。
- [ ] `pnpm typecheck` + `pnpm build`（或 npm 等价脚本：`npm run typecheck` / `npm run build`）通过。
- [ ] `.trellis/spec/frontend/component-guidelines.md` 的 `DateTimePicker` 段落同步更新（TimeField 键盘契约描述移除）。

## Key Decisions

- **方案 B：原生 `<input type="time" step={1}>`**（用户选定）。理由：浏览器自带段编辑/步进键盘交互，无自实现跳段 bug 空间；value 格式与现有契约天然兼容；零新依赖。代价：外观需用 CSS 定制以贴合 teal 风格（伪元素定制在主流 Chromium/Firefox 上可用）。
- **任务定级 lightweight（PRD-only）**：单组件内部替换，无架构边界变化，不设 design.md / implement.md。

## Risks / Notes

- 原生 time input 的 picker 指示器与段样式跨浏览器有差异：以 Chromium 为准做视觉验收，Firefox 保证功能正确即可。
- 上游 spec 段落：`.trellis/spec/frontend/component-guidelines.md` 的 `DateTimePicker` 段落（含 TimeField 键盘契约）在完成时更新。
