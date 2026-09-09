# Axis view entry styling and width constraint

## Goal

改进 day 时间线「条目（轴）」子视图的视觉设计：

1. 条目卡片换一种形态（方向 C：调整色条位置、染色方式、圆角等卡片形态细节）
2. 整个轴视图列表区域限宽居中，不再占满时间线容器全宽

## Background（现状）

- 组件：`web/src/components/EntryListView.tsx`（EntryRow / GapRow / footer）
- 样式：`web/src/styles.css` 中 `.entry-view-*` 系列（约 379–566 行）
- 现状布局：`.entry-view-row` 为 `grid-template-columns: 56px 8px 1fr`，外层
  `p-2 md:p-4` 填满 Timeline 容器 → 卡片拉到全宽
- 现状卡片形态：左缘 3px 分类色竖条（内联 borderLeft）+ 分类色 8% 染色底
  （CSS 变量 `--entry-card-color`，hover 15%）+ `--radius-lg` 圆角 + 44px 最小高度
- 测试：`web/src/components/Timeline.test.tsx` 含子视图渲染、localStorage 记忆、
  正序排列等断言（543–562 行附近）

## Requirements

### R1 条目卡片形态重设计

调整卡片视觉形态（色条、染色、圆角等细节），保持既有信息结构不变：
时间列（开始/结束两行）+ 刻度短线 + 卡片（描述/分类/标签/时长）。
运行中呼吸动画、选中 ring、hover 反馈、≥44px 触控目标均需保留。
具体形态在设计阶段（design.md）定稿。

### R2 轴视图列表限宽居中

条目子视图的列表区域整体限宽并水平居中，宽屏下两侧留白；
移动端（<768px）保持现状全宽（窄屏没有限宽意义）。

## Out of Scope

- 块视图（block subview）与 week 模式的样式
- 排序、gap 幽灵卡交互逻辑、popover/编辑器行为
- localStorage 键与子视图切换逻辑（09-08-axis-view / 09-08-remove-entry-sort 已定）

## Acceptance Criteria

- [ ] AC1 卡片视觉形态按方案 H「染色卡」落地：无左缘竖色条、无描边，
  分类色约 10% 底色染色；信息结构不变（时间/描述/分类/标签/时长）
- [ ] AC2 运行中呼吸（底色深浅 10%↔22%）、选中 ring、hover 提亮、
  44px 触控目标等既有反馈保留
- [ ] AC3 宽屏（≥768px）下轴视图列表区域限宽 520px 居中，卡片不再拉伸全宽；
  窄屏保持全宽
- [ ] AC4 现有 Timeline 子视图相关测试全部通过，样式改动不破坏既有断言

## Key Decisions

- D1（Q1 卡片形态）：方案 H「染色卡」——完全去掉卡片左缘竖色条，卡片无线条
  无描边，用分类色约 10% 底色染色作为容器本身；hover 提亮至 18%；运行中改为
  底色深浅呼吸（10%↔22%，替代原 ::before 色条呼吸）。视觉稿：`mockup.html`
- D2（Q2 限宽值）：列表内容区限宽 520px 居中（≥768px 生效，窄屏全宽）：
  时间列 56px + 间距后卡片仍有约 400px 文本宽，长描述不被过早截断，宽屏
  留白也足够明显
