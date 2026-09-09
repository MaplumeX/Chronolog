# 重新设计条目起止时间编辑组件

## Goal

重新设计 `EntryEditor` 中开始/结束时间的编辑体验，降低调整时间的操作成本，并消除当前实现的结构性缺陷。

## Background（代码事实）

- `EntryEditor.tsx`（web/src/components/EntryEditor.tsx:178-194）：开始/结束时间为两个垂直排列的独立 `DateTimePicker`，时长在下方单独一行只读展示（由起止推导，`Math.max(0, ...)` 兜底）。
- `DateTimePicker.tsx`：Button + Popover 触发，弹层内含 Calendar（react-day-picker）+ 原生 time input（step=1）+「现在」按钮。value 契约为 `"YYYY-MM-DDTHH:mm:ss"` 本地时间字符串。
- `DateTimePicker` 仅被 `EntryEditor` 使用（两处），重设计可自由改造或替换，无其他调用方。
- 编辑器宿主是 `Timeline.tsx:836/853` 的 `PopoverContent className="w-80"`（约 320px 宽），新组件需适配该宽度约束。
- `EntryEditor` 同时服务两种模式：编辑已有条目（entry）与新建草稿（draft，拖拽/空隙创建，时间来自拖拽位置）。
- 现有缺陷：起止完全独立编辑，可产生 end < start（仅靠时长显示 00:00:00 兜底，无校验提示）；跨天调整需分别打开两个弹层；时长只能间接编辑。

## Requirements

**已选定方向 C：紧凑行内 + 时长可编辑**（2026-09-09 经四方向 demo 体验后用户选定）。

- R1 紧凑行内展示：一行内并列「开始 → 结束 · 时长」三个可点击槽位（替代现有两个垂直 DateTimePicker + 只读时长行）。
- R2 三个槽位均可点击展开编辑面板（展开位置与形态沿用 demo C 的卡片内展开式）：
  - 开始/结束：HH:mm:ss 原生 time input（step=1）+ 日期调整（Calendar 弹层）。
  - 时长：文本输入（支持 `H:MM:SS` / `H:MM` / `90m` / `1.5h` 类格式）+ 快捷时长（15/30/60/90 分钟）+「到现在」；提交后以开始时间为锚反推结束时间。
- R3 跨天展示：起止不同天时，对应槽位显示日期副行（demo C 已验证）。
- R4 适配约束：组件宿主为 `PopoverContent w-80`（约 320px），紧凑行需在此宽度内完整展示。
- R5 兼容两种模式：编辑已有条目与新建草稿（拖拽/空隙创建），后者时间初值来自拖拽位置。
- R6 时长输入非法（无法解析）时：不清空、不提交，保留原值并可重输（demo C 行为）。
- R7 i18n：所有新文案纳入 zh/en 两个 locale 文件；a11y：槽位/输入有 aria-label，键盘可操作。
- R8 `DateTimePicker` 被 `EntryEditor` 移除引用后删除（唯一调用方为 EntryEditor），避免死代码。
- R9 约束策略（OQ1 定案 a）：保存时硬校验，end ≤ start 拒绝保存并在现有错误提示区域显示新增 `entry.invalidRange` 文案；编辑期间不联动、不自动修改另一端。
- R10 「现在」快捷操作（OQ2 定案：删除）：开始/结束编辑面板不提供「现在」按钮；仅时长面板保留「到现在」（结束=当前时刻）；随 DateTimePicker 删除一并移除 `entry.now` i18n key。

## Acceptance Criteria

- [ ] AC1 编辑已有条目：时间区域呈现单行「开始 → 结束 · 时长」，三槽位可分别点击展开编辑，再次点击收起。
- [ ] AC2 修改时长（含快捷键与「到现在」）后保存，条目结束时间被反推更新。
- [ ] AC3 起止跨天时槽位显示日期副行；通过日期调整可将条目改为跨天。
- [ ] AC4 新建草稿（拖拽/空隙创建）同样使用新组件，初值为拖拽位置对应时间。
- [ ] AC5 end ≤ start 时保存被拦截（R9 硬校验），错误提示可见。
- [ ] AC6 时长输入非法时不破坏当前状态，可重新输入。
- [ ] AC7 切换 zh/en 语言，新组件文案正确切换；屏幕阅读器可识别各槽位语义。
- [ ] AC8 `DateTimePicker.tsx` 及其引用被移除，无死代码残留；typecheck + 现有测试全部通过。
- [ ] AC9 demo 文件（`web/demo.html`、`web/src/demo/`）在正式实现完成后移除。

## Out of Scope

- 步进器微调（方向 D）、联动式单面板（方向 A）——已被否决，不做组合叠加。
- 后端 API 变更（时间编辑接口契约不变）。
- Timeline 拖拽创建交互本身。
- MergeDialog、相邻合并相关交互。

## 已定案决策

- 设计方向：C 紧凑行内 + 时长可编辑（2026-09-09 经四方向 demo 体验选定）。
- 约束策略：保存时硬校验（R9）。
- 「现在」按钮：不加入开始/结束面板，仅时长面板保留「到现在」（R10）。
- 时长可编辑：是，以开始时间为锚反推结束时间（R2）。


## Planning Artifacts

- 交互原型：`web/demo.html`（入口）+ `web/src/demo/main.tsx`（四方向并列，共享 `"YYYY-MM-DDTHH:mm:ss"` 状态契约，便于胜出方向迁移）。仅为决策辅助，任务结束前应移除或随正式实现替换。
