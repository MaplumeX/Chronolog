# Design — Chip-based category and tag pickers

## 1. 架构与边界

改动全部落在 `web/`，不触碰 `server/`（AC12）。组件分三层，边界与现有约定一致：

```
useTimerController (hook, 唯一 api 消费者)
  │  组装 barProps.categoryPicker / .tagPicker 两个 ReactNode 插槽
  ├─→ TimerBar          (桌面顶栏, 纯展示)  ── 双行布局
  └─→ MobileTimerDock   (移动停靠+sheet, 纯展示)

EntryEditor (popover/sheet 内容, 自持 api 调用)
  └─→ CategoryPicker / TagPicker

CategoryPicker / TagPicker  (领域层: 层级 + 选择语义)
  └─→ ChipGroup             (基元层: 渲染 + 视觉 + 可访问性)  ← 新建
```

**关键边界约束（沿用现有 spec）**：

- `ChipGroup` 与 `TimerBar` / `MobileTimerDock` 均为纯展示组件：不 import `api`、
  不含 `t()`（文案由调用方传入），与 `ConfirmDialog` 同契约。
- `CategoryPicker` / `TagPicker` 可以 import `hierarchy.ts` / `format.ts`（纯函数），
  但不 import `api`。`TagPicker` 现有的 `t("tags.empty")` 是既有例外，保留。
- 插槽装配仍在 `useTimerController`，`TimerBar` / `MobileTimerDock` 不感知 picker 类型。

## 2. ChipGroup 契约

```ts
type ChipItem = {
  id: string;
  name: string;
  color: number | null;   // 调色板索引 1–8，null = 按 name hash 回退
};

type ChipGroupProps = {
  /** 两段式数据：与 sortHierarchical() 的 { parent, children }[] 同构 */
  groups: { parent: ChipItem; children: ChipItem[] }[];
  /** 选中集合（单选传 0/1 个元素，多选传 N 个）——组件本身不区分单/多选 */
  selectedIds: string[];
  /** 视觉变体：分类=实心填充，标签=描边（D1） */
  variant: "solid" | "outline";
  /** 当前展开的父级 id；null = 全部收起。受控，由领域层持有 */
  expandedParentId: string | null;
  onExpandChange: (parentId: string | null) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** 只读尾随胶囊（D7），null = 不渲染 */
  readonlyChip?: { name: string } | null;
  /** 引导脉冲（D8）：true 时容器带脉冲 class */
  hinted?: boolean;
  /** 空态文案（TagPicker 传 t("tags.empty")） */
  emptyText?: string;
};
```

**设计取舍**：`ChipGroup` 不区分单选/多选。它只接收 `selectedIds` 与 `onSelect(id)`，
由 `CategoryPicker`（替换）/ `TagPicker`（toggle）在领域层实现语义差异。
这样基元层不承载业务分支，测试面最小。

`expandedParentId` 做成**受控**而非组件内 state：领域层需要根据 `value` 派生初值
（R2.3 / R3.4「选中子级时父级默认展开」），受控形式让派生逻辑留在领域层，
基元层保持无状态。

## 3. 触屏命中区（重要技术约束）

现有 `.touch-hit` 用 `::after { inset: -8px }` 全周扩展，`styles.css:628-630`
的注释明确写着**「相邻控件间的间距需 ≥16px 才不重叠」**。

胶囊组用 `gap-1.5`（6px），远小于 16px —— **直接套用 `.touch-hit` 会导致相邻胶囊的
伪元素互相覆盖，后一个兄弟节点的伪元素赢，前一个胶囊命中区反而变小**
（这正是 `component-guidelines.md` 已记载的那个 gotcha）。

**结论：胶囊不使用 `.touch-hit`。** 改为在 `@media (hover: none)` 下直接增大胶囊
自身的垂直 padding，使实际高度 ≥40px：

```css
@media (hover: none) {
  .chip {
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
}
```

代价：触屏下胶囊视觉尺寸确实变大（`.touch-hit` 的卖点是视觉不变）。
但胶囊是**主操作目标**而非行内小图标按钮，变大是合理的，与 `MobileTabBar`
的 `min-h-[48px]` 同思路。这一点必须写进 spec，避免后人误用 `.touch-hit`。

## 4. 胶囊三态配色

颜色全部派生自 `paletteColor(color, name)` 返回的 `var(--category-N)`，
无硬编码色值（AC10）。因为色值是运行时 inline style，而 `color-mix` 需要在 CSS 侧，
采用**与 `EntryListView` 卡片染色同构的 CSS 变量桥接**（项目已有先例）：

```tsx
<button className="chip" style={{ "--chip-color": paletteColor(c.color, c.name) }} />
```

```css
/* 未选中：中性 outline，仅色点带色 */
.chip { border: 1px solid var(--border); background: transparent; }

/* 分类选中（solid）：实色填充 */
.chip--solid[aria-pressed="true"] {
  background: var(--chip-color);
  color: var(--chip-foreground);
  border-color: transparent;
}

/* 标签选中（outline）：彩色描边 + 淡色底 */
.chip--outline[aria-pressed="true"] {
  border-color: var(--chip-color);
  background: color-mix(in srgb, var(--chip-color) 12%, transparent);
}
```

`--chip-foreground` 同理由 `paletteForegroundColor(color, name)` inline 注入。

**为什么底色必须写在 CSS 而非 inline**：若把 `background` 写成 inline style，
`:hover` / `[aria-pressed]` 的 CSS 规则无法覆盖（inline 优先级更高）。
这是 `component-guidelines.md` 已记载的 `--entry-card-color` 踩坑经验，直接沿用。

只读胶囊（D7）：`.chip--readonly`，`text-muted-foreground` + `Archive` 图标，
不带 `--chip-color`（归档项不强调颜色），`disabled` + `aria-disabled`。

## 5. 桌面双行 header 布局

### 5.1 Shell 侧改动（最小化）

现状 `Shell.tsx:226`：

```tsx
<header className="flex min-h-12 shrink-0 items-center border-b px-2">
  <SidebarTrigger />
  {props.header}
</header>
```

`items-center` 在双行内容下会把 `SidebarTrigger` 垂直居中到两行中间，与常规顶栏观感不符。
改为：

```tsx
<header className="flex min-h-12 shrink-0 items-start border-b px-2">
  <div className="flex min-h-12 shrink-0 items-center"><SidebarTrigger /></div>
  {props.header}
</header>
```

- `items-start` 让 header 高度由内容擑开（R4.4）；
- `SidebarTrigger` 包一层 `min-h-12 items-center` 的 flex 容器，保证它在**第一行**
  垂直居中且不被 `items-start` 拉伸变形（R4.3）；
- 非 timer 页传入的是单行 `<h1 className="px-2 text-xl…">`，它本身无高度，
  需确认在 `items-start` 下仍垂直居中——给 `App.tsx` 的 h1 加 `flex min-h-12 items-center`
  或等价处理（AC8 盯这一点）。

### 5.2 TimerBar 内部

```tsx
<div className="shrink-0 px-4 py-3">
  {/* 行 1：描述 + 计时 + 按钮 */}
  <div className="flex items-center gap-3">
    <input className="min-w-0 flex-1 …" />
    <div className="font-mono text-xl tabular-nums">{elapsed}</div>
    <Button className="size-11 rounded-full" />
  </div>
  {/* 行 2：胶囊带 */}
  <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2">
    {categoryPicker}
    <div className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
    {tagPicker}
  </div>
</div>
```

分隔线用 hairline `w-px bg-border`，与项目内 hairline 分层语言一致（R4.2）。
两组都可能自行折行，外层也用 `flex-wrap` 保证极端宽度下两组可上下堆叠。

现有 `md:flex-row` 响应式堆叠代码可以删除：`Shell` 移动分支根本不渲染 `TimerBar`
（`component-guidelines.md` 已标注它是 dead markup）。

### 5.3 高度传导验证

`SidebarInset` 是 `min-h-0 overflow-hidden`，内容区是 `flex min-h-0 flex-1 overflow-auto`。
header 带 `shrink-0`，因此 header 长高 → 内容区 `flex-1` 自动变矮 →
Timeline 在自己的 `overflow-auto` 内滚动。**结构上已满足 AC7**，无需额外改动；
实现时需实测确认不出现页面级滚动条。

## 6. 引导信号链路（D8）

### 6.1 现有信号的 4 个触点

| 位置 | 作用 | 改动 |
|------|------|------|
| `use-timer-controller.tsx:92` | `useState(false)` 声明 | 重命名为 `categoryHintActive` |
| `:169` | `if (!running) set…(false)` 复位 | 仅改名 |
| `:247` | 无间隙换段后置位 true | 仅改名 |
| `:332` | 传给 `CategoryPicker` 的受控 `open` | **删除**，改传 `hinted` |
| `:363` | 传给 `barProps.autoOpenEditor` | 保留（移动 sheet 仍需） |

信号语义从「开关下拉菜单」变为「引导用户选分类」，一个信号两个消费端：

```
categoryHintActive
  ├─→ CategoryPicker.hinted    (双端)  → 胶囊行脉冲动画
  └─→ barProps.autoOpenEditor  (移动)  → MobileTimerDock sheet 派生打开
```

### 6.2 信号复位时机（不变）

- 选中分类→ `onChange` 里 `setCategoryHintActive(false)`（现有 `:337` 逻辑）；
- 用户关 sheet → `onAutoOpenConsumed()`；
- `running` 消失 → `:169` 的 effect 复位。

### 6.3 动画实现（关键：不能 infinite）

现有 `timeline-pulse` 是 `infinite` 的（`styles.css:340`），**不能直接复用**。
新增有限次数键帧：

```css
@keyframes chip-hint-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ring) 40%, transparent); }
  50%      { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ring) 15%, transparent); }
}
.chip-group--hinted {
  border-radius: var(--radius-md);
  animation: chip-hint-pulse 0.8s ease-in-out 2;  /* 跑 2 轮 ≈ 1.6s 后自停 */
}
```

用 `animation-iteration-count: 2` 而非 JS 定时器：无需额外 state、无需清理，
且信号提前被消费时 class 移除→动画立即停（R7.3 两个停止条件都满足）。

**已知限制**：若信号长时间保持 true（用户不选分类就切页再回来），动画不会重放
（CSS 动画只在 class 首次挂载时跑）。这与现有「待完成引导」语义（sheet 会重开）
略有出入，但胶囊本身全部未选中的视觉已是足够提示，列为可接受。

## 7. 兼容性与数据契约

### 7.1 无数据迁移

API 形状、数据库 schema、localStorage 键均不变。本任务是纯展示层重构，
`server/` 零变更（AC12）。升级 / 回滚无状态兼容问题。

### 7.2 下线的公共契约

| 符号 | 位置 | 处置 |
|------|------|------|
| `CategoryPicker.open` / `.onOpenChange` | 组件 props | 删除（仅 `useTimerController` 使用） |
| `CategoryPicker.label` / `.colorName` | 组件 props | 删除（触发器已不存在） |
| `TagPicker.label` | 组件 props | 删除 |
| `runningTags` / `runningTagColors` | `barProps` + 两个消费端 | 删除（D6） |
| `timer.selectTags` / `timer.tagSeparator` | zh + en | 删除（R3.6） |
| `timer.selectCategory` | zh + en | **保留**：分类组的 `Label` 文案仍可用 |

`en.ts` 类型为 `Record<keyof typeof zh, string>`，删 key 必须两侧同步，
否则 `typecheck` 会报错——这是自动门禁（AC13）。

### 7.3 回滚形状

单 commit 完成，`git revert` 即可完全回退。无需分阶段发布、无 feature flag：
改动不跨服务、不涉持久化状态。

## 8. 关键权衡记录

1. **ChipGroup 不区分单/多选**（§2）——基元层不承载业务分支，
   代价是领域层各自写 toggle/replace，收益是基元层测试面最小。
2. **`expandedParentId` 受控而非内部 state**（§2）——让「选中子级时父级展开」
   的派生逻辑留在领域层，基元层无状态。
3. **胶囊不用 `.touch-hit`**（§3）——gap 6px < 要求的 16px，伪元素会互盖；
   改用真实 padding，接受触屏下视觉变大。**此项必须写入 spec**。
4. **底色走 CSS 变量而非 inline background**（§4）——inline 优先级会阻断 hover/选中态
   覆盖，沿用 `--entry-card-color` 已验证的模式。
5. **动画用 `iteration-count: 2` 而非 JS 定时器**（§6.3）——零额外 state、
   零清理，代价是信号持续时不重放（已评估为可接受）。
6. **双行 header 而非单行横滚**（§5）——接受 header 高度可变，
   换取无隐藏项且与周视图横滚不冲突。
