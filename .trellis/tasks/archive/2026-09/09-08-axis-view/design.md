# 轴视图 技术设计

## 1. 边界与数据流（修订：day 子视图，非第三模式）

```
use-timer-controller（完全不动）
  ├─ today / week / boundary / date / nowMs / tz / dayTotal
  └─ view: "day" | "week"  ← 保持两态，不改
        │
Timeline.tsx（壳：Tabs / DateNav / 合计 / 滚动容器 / EntryEditor popover 编排）
  ├─ day 模式：
  │    ├─ subview 状态（Timeline 内部）： "block" | "entries"   ← 新增
  │    │    （localStorage chronolog-day-subview 记忆，失效回退 block）
  │    ├─ block  → DayColumn（现有比例视图，不动；scale 状态保留）
  │    └─ entries → EntryListView（新，纯 UI：props 注入数据与回调）
  └─ week 模式 → DayColumn ×7（不动，无子视图切换）
```

- 数据层零改动：view 仍是 `"day" | "week"`，controller 不感知子视图。
- `EntryListView` 不 import api（符合 frontend/component-guidelines.md），
  编辑/创建全部经 props 上抛，由 Timeline 复用现有 popover 编排。
- `subview` 是 Timeline 的局部状态（两个子视图渲染同一 `today` 数据，
  不需要 controller 参与）；与 `scale` 同级同生命周期。

## 2. 组件契约

### EntryListView props

```ts
interface EntryListViewProps {
  day: TodayEntries | null;
  nowMs: number;
  tz: string;
  categories: Category[];
  tags: Tag[];
  gaps: Gap[];                       // Timeline 已算好的当日 gap（全局绝对时刻）
  selectedId: string | null;         // 编辑选中（popover 由 Timeline 持有）
  onSelect: (id: string) => void;
  onGapClick: (gap: Gap) => void;    // 幽灵卡点击 → Timeline 的 gapDraft 流程
}
```

- 排序（正序/倒序）是 EntryListView 内部状态 + localStorage
  （key `chronolog-entry-view-sort`），不上升到 Timeline props。
- 行序（含 gap）：把条目与 gap 合并成时间序事件流后统一渲染；
  gap 与其可见窗口截断逻辑复用现有语义（跨午夜 gap 在本窗口截断显示）。

### Timeline.tsx 改动（局部）

- 新增 `const [subview, setSubview] = useState<Subview>(loadSubview)`；
  day 模式头部渲染「块/条目」图标切换对（week 模式隐藏），与缩放按钮同组。
- day && subview === "entries" 时渲染 `<EntryListView>` 替代 DayColumn；
  block 分支原样（scale 状态保留下，切回即恢复）。
- gap 数据用现有 `todayGaps`；`computeGaps` + `Gap` 类型抽到
  `web/src/timeline-gaps.ts` 供两视图共享（纯移动，行为零变化）。
- 选中编辑 popover / gapDraft popover 编排逻辑**原样保留**：
  selectedEntry 查找在 day 模式下仍用 `today.entries`，subview 无关，
  天然成立；gapDraft 的 anchor 改锚幽灵卡行（见 §3.3）。
- 缩放按钮（±）仅 block 子视图显示（entries 无 scale 概念）。

## 3. 行渲染细节

### 3.1 时间列（两行式）

```
 ─┤ 08:12     ← 刻度短线 + 开始（foreground，tabular-nums，右对齐）
   09:30     ← 结束（muted-foreground）
```

- Grid：`[56px 时间列] [8px 刻度区] [1fr 卡片]`；行内 `items-center`，
  矮卡片（单行卡）相对两行时间列竖直居中。
- 刻度短线：横向 8px × 1px `border` 色短线，位于开始时间行高度的中心，
  形成轻量「轴节点」。
- 运行中：下行 `···`（muted），不显示跳动数字。
- 跨午夜：结束 HH:MM 原样显示（如 23:10 / 00:40）。
- 幽灵卡行：时间列同样显示 gap 起止两行（告诉用户补录覆盖的范围）。

### 3.2 条目卡（可变高度）

- 单行卡（无描述且无标签）：`[▐ 分类名]` + 右侧时长；高 ≈44px（触控目标）。
- 两行卡：上行描述（font-medium），下行 `● 分类 · 标签徽章` + 右侧时长。
  - 无描述但有标签：上行降级显示分类名（同 `timeline.noDescription` 回退链）。
- 卡片底色：`color-mix(in srgb, 分类色 8%, var(--card))`；hover 15%。
  运行中：左缘 3px 色条呼吸动画（CSS `@keyframes`，2s opacity 循环）。
- 选中态：`ring-2 ring-primary/50`；PopoverAnchor 零尺寸锚点钉卡片中心
  （同现有 timeline-block 手法，popover 从卡片右侧弹出）。
- 颜色：`paletteColor(categoryColor, categoryName)` +
  `paletteForegroundColor`，与 timeline-block 完全一致（hash 回退不可改）。

### 3.3 幽灵卡（gap）

- 虚线边框（`border-dashed border-border`）、高度约正常卡一半、内容居中
  `+ 空档 45 分钟`（i18n `timeline.gapGhost`），hover 提亮。
- 点击 → `onGapClick(gap)` → Timeline 现有 `handleGapClick(dayStart)`：
  以 gap 全局起止建 `gapDraft`，popover 锚定幽灵卡行（PopoverAnchor
  零尺寸锚点钉幽灵卡中心，传递方式与选中卡一致——经 EntryListView 内部
  在被点幽灵卡行渲染 anchor，由 selectedGap 状态控制）。
  - 与块视图差异：块视图 anchor 用「可见段快照」（gap 数据刷新防移位）；
    条目视图行位置由条目序列决定，编辑 popover 打开期间 today 刷新可能
    重排行，故沿用快照思路——点击时固化 anchor 行位置（以行内 anchor 元素
    存在为准，gapDraft 数据结构不变）。

### 3.4 结账线（R7）

- 列表底部：`<Separator>` + 居中淡色文本 `9月8日 · 6h42m`
  （`formatDayLabel` 风格 + `formatDuration(dayTotal)`，i18n 模板
  `timeline.entryViewFooter`）。
- 空状态：无条目时居中显示 i18n `timeline.weekEmpty`（复用「无记录」）。

### 3.5 滚动

- 列表容器复用 Timeline 的滚动容器；今天正序时初始滚到底部（运行中在最后），
  倒序时在顶部；查看历史日期正序时滚到顶部。滚动逻辑在 EntryListView 的
  `useEffect`（挂载时执行一次，同现有 anchor 滚动手法，不做持续跟随）。

## 4. 样式组织

- 新增 CSS 追加到 `web/src/styles.css`（与 .timeline-* 同区，前缀
  `.entry-view-`）：`.entry-view-row` / `.entry-view-time` / `.entry-view-tick`
  / `.entry-view-card` / `.entry-view-card--single` / `.entry-view-ghost` /
  `.entry-view-card--running`（呼吸动画）/ `.entry-view-footer`。
- 设计 token 遵循 frontend/design-tokens.md（颜色全部走 CSS 变量，
  分类色走内联 color-mix，同 timeline-block）。

## 5. i18n

`web/src/i18n/locales/zh.ts` / `en.ts` 新增：

- `timeline.viewEntries`：条目 / Entries（子视图切换）
- `timeline.viewBlock`：块 / Blocks（子视图切换，tooltip/aria）
- `timeline.gapGhost`：`+ 空档 {{duration}}` / `+ Gap {{duration}}`
- `timeline.entryViewFooter`：`{{date}} · {{total}}` / 同构英文
- `timeline.sortAsc` / `timeline.sortDesc`：正序 / 倒序（tooltip）
- 复用：`timeline.noDescription`、`timeline.weekEmpty`、`timeline.gapTitle`

## 6. 权衡与备选记录（决策依据）

- **架构**：独立第三模式 vs day 子视图——用户拍板子视图（贴合「同一份数据的
  两种呈现」心智）；好处是 controller/数据层零改动，week 模式不受影响。
- 放弃左右交错（移动端无两侧空间）、纯紧凑表（用户希望卡片容器）、
  半比例行高（与非比例初衷冲突）、行内迷你条（阅读成本高）。
- 时间列两行式是用户明确要求：开始亮/结束淡，衔接处数字呼应（AC9）。
- 缩放按钮仅 block 子视图显示：entries 视图无比例概念，避免无效控件。

## 7. 兼容与回滚

- 纯前端增量：新组件 + Timeline 内 subview 状态 + CSS/i18n；
  controller、DayColumn、week 模式全不动。回滚 = revert 单个 commit。
- `chronolog-date-view` / 既有 view 持久化不受影响；新 key
  `chronolog-day-subview` / `chronolog-entry-view-sort` 失效时回退默认值。
