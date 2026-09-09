# Design: 轴视图染色卡 + 列表限宽居中

## 1. 目标形态（方案 H）

参照视觉稿 `mockup.html`（同目录）「方案 H：染色卡」面板。

### 卡片（`.entry-view-card`）

| 属性 | 现状 | 新形态 |
|---|---|---|
| 左缘 | 3px 分类色竖条（内联 borderLeft） | **移除** |
| 底色 | 分类色 8% 染色（`--card` 混合） | **分类色 10% 染色**（不变量：底色必须留在 CSS，hover 才能覆盖） |
| hover | 15% 染色 | **18% 染色** |
| 运行中 | `::before` 3px 色条 opacity 呼吸 + 内联 borderLeft 透明 | **底色深浅呼吸**（10%↔22%，keyframes 动画 background，删 ::before 覆盖层） |
| 圆角 | `--radius-lg` | `--radius-md`（去色条后卡片更轻，圆角略收敛） |
| 描边/选中 ring/触控 | 保留 | 保留不变（ring 用 `--ring` color-mix） |
| 分类色点/文字/标签/时长 | 保留 | 保留不变 |

`--entry-card-color` CSS 变量注入机制不变（EntryRow 内联注入，CSS 消费）。

### 列表区域（R2 限宽居中）

`EntryListView` 内容列（含时间列 + 卡片 + footer）在 ≥768px 下
`max-width: 520px; margin-inline: auto;`，窄屏全宽。空态提示文案也应在限宽
容器内居中。

## 2. 实现边界

改动仅两处：

1. `web/src/components/EntryListView.tsx`
   - `EntryRow.cardStyle`：删 `borderLeft` 注入（运行中不再需要透明占位）
   - 列表容器加限宽类（如 `.entry-view-body`，包住行列表 + footer + 空态）
2. `web/src/styles.css` `.entry-view-*` 段
   - `.entry-view-card`：改圆角、删 `border-left: none` 注释、底色 10%
   - `.entry-view-card:hover`：18%
   - 删 `.entry-view-card--running::before`，新增 `@keyframes entry-view-breathe-bg`
     （background 10%↔22%），`.entry-view-card--running` 引用之
   - 新增 `.entry-view-body` 限宽居中（`@media (min-width: 768px)` 内 max-width:520px）

**不改**：`Timeline.tsx`（subview 逻辑、zoom 按钮显隐）、gap 幽灵卡样式、
footer、时间列、刻度短线、PopoverAnchor/RectSnapshot 锚点机制、i18n。

## 3. 风险与权衡

- **运行中呼吸从色条换成整卡底色**：视觉面积变大，动画幅度刻意保守（10↔22%
  而非更高），避免大面积闪烁感；`prefers-reduced-motion` 下 keyframes 会
  跳到 0%/100% 基值，无破坏。
- **hover 18% vs 呼吸 22%**：运行中卡片不可点击（无 hover 冲突），两档接近
  但不重叠，静态卡 hover 反馈仍然可辨。
- **520px 取值**：时间列 56 + gap 8 + 列间距 4×2 ≈ 72px，卡片文本区约
  448px，实测长中文描述（~28 字）不截断。
- 测试断言只查 `.entry-view-card` 等 class 存在性，不涉及内联 borderLeft，
  预计无需改测试；若 check 阶段发现 class 快照断言再处理。

## 4. 验证

- `cd web && npx vitest run` 全绿
- 手动：宽/窄窗口下确认限宽居中与全宽切换；运行中条目呼吸；hover 提亮；
  选中 ring；gap 幽灵卡点击 popover 锚点不漂移
