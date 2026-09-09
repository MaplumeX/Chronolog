# 轴视图 实施计划

## 前置

- 基线：branch `emdash/floppy-glasses-hunt-qvw14`，工作区干净（除本任务目录）。
- 验证命令：`npm run typecheck -w web`、`npm test -w web`。

## Step 1：gap 逻辑提取共享模块

- [ ] 新建 `web/src/timeline-gaps.ts`：从 `Timeline.tsx` 移出 `Gap` 类型与
      `computeGaps`（含注释），`Timeline.tsx` 改为 import。
- [ ] 验证：typecheck + 既有 Timeline 测试全绿（纯移动，零行为变化）。

## Step 2：EntryListView 组件（核心）

- [ ] `web/src/components/EntryListView.tsx`：props 契约见 design §2；
      内部状态：排序（localStorage `chronolog-entry-view-sort`）。
- [ ] 行合并：entries + gaps 按时间排序成事件流（gap 用可见窗口截断段）。
- [ ] 时间列两行式 + 刻度短线（design §3.1）。
- [ ] 可变高度卡片（§3.2）：单行/两行卡、染色、色条、选中 ring、运行中
      呼吸动画 + `···`。
- [ ] 幽灵卡（§3.3）：虚线框 + gap 起止时间列 + 点击 onGapClick。
- [ ] 结账线（§3.4）+ 空状态。
- [ ] 初始滚动（§3.5）。
- [ ] 样式追加 `web/src/styles.css`（`.entry-view-*` 前缀）。
- [ ] i18n：`timeline.gapGhost` / `timeline.entryViewFooter` /
      `timeline.sortAsc` / `timeline.sortDesc`（zh + en）。
- [ ] 验证：typecheck；组件独立可渲染（下一步集成后手测）。

## Step 3：Timeline 集成 day 子视图

- [ ] Timeline 新增 `subview` 状态（localStorage `chronolog-day-subview`，
      失效回退 `block`）；day 模式头部加「块/条目」图标切换对（与缩放按钮同组；
      week 模式隐藏），i18n `timeline.viewEntries` / `timeline.viewBlock`。
- [ ] `day && subview === "entries"` 渲染 `<EntryListView>`（传 todayGaps /
      selectedId / onSelect / handleGapClick(dayStart)）；block 分支原样，
      scale 状态保留（切回恢复）。
- [ ] 缩放按钮（±）仅 block 子视图显示。
- [ ] gapDraft popover 在 entries 子视图下锚定被点幽灵卡行（点击时固化 anchor）。
- [ ] 验证：`npm run dev` 手测——三态组合（day×block / day×entries / week）、
      切换记忆、缩放保留、点击编辑、幽灵卡补录、运行中递增、移动端宽度模拟。

## Step 4：测试

- [ ] `EntryListView.test.tsx`：
  - 渲染行数 = 条目 + 可见 gap 数
  - 时间列两行（开始/结束）、运行中 `···`
  - 单行/两行卡切换逻辑（有无描述/标签）
  - 点击卡片 → onSelect；点击幽灵卡 → onGapClick(gap)
  - 排序切换 + localStorage 记忆
  - 空状态、结账线文本
- [ ] `Timeline.test.tsx` 补：day 模式子视图切换渲染 EntryListView /
      切回 DayColumn；week 模式无切换控件；记忆保持。
- [ ] 验证：`npm test -w web` 全绿 + `npm run typecheck -w web`。

## Step 5：收尾

- [ ] Phase 3.3 spec 检查：component-guidelines / design-tokens 是否需要
      增补（预计不需要，模式与既有一致）。
- [ ] commit（单 commit，可回滚）。
- [ ] journal 记录 + trellis-finish-work。

## 回滚点

- Step 1 独立可 revert（纯重构）。
- Step 2–4 一个功能单元，整体 revert。
