# 移动端计时器底部停靠胶囊 — 执行计划

前置：`design.md` 已定稿；分支 `feat/redesign-mobile-timer-header` 已存在，可直接使用。

## 步骤

### 1. CSS token + MobileTimerDock 骨架
- [ ] `web/src/styles.css`：`:root` 增加 `--mobile-tabbar-h: 48px`（与
      `MobileTabBar` 的 `min-h-[48px]` 对应）。
- [ ] 新建 `web/src/components/MobileTimerDock.tsx`：纯展示组件，props 对齐
      `TimerBar`（description / onDescriptionChange / categoryPicker / tagPicker /
      runningTags / runningTagColors / elapsed / running / canStart / onToggle / error）。
- [ ] 胶囊行：fixed 定位（Tab 栏上方）、色点 + 描述 truncate + 时长 tabular-nums +
      开始/停止圆按钮（`stopPropagation`）。
- [ ] 展开态：`ui/sheet` `side="bottom"`（#51 规格：drag-handle、`max-h-[85dvh]`、
      safe-area padding），内容为 TimerBar 的编辑元素纵向排布，不含开始/停止按钮。
- [ ] i18n：新增 `timer.dock`（sheet srTitle / aria）等 key，zh + en。

### 2. Shell 接线
- [ ] `Shell.tsx`：新增可选 prop `mobileTimerDock?: ReactNode`；移动端分支在
      `MobileTabBar` 后渲染该插槽；timer 页 header 用 `t("nav.timer")` 标题替换
      （其他页 header 不变），桌面分支完全不动。
- [ ] 内容区底部 padding：timer 页移动端追加 `+3.5rem`（胶囊高度），仅胶囊在位时。
- [ ] `App.tsx`：组装 `<MobileTimerDock {...timer.barProps} />` 传给 Shell
      （桌面端 Shell 忽略）；`header` 组装逻辑不动。

### 3. 测试
- [ ] 新增 `MobileTimerDock.test.tsx`：
  - 渲染：描述摘要/placeholder、时长、色点、按钮变体（default/destructive/disabled）
  - 交互：点胶囊行打开 sheet；点开始/停止按钮不开 sheet 且触发 onToggle；
    sheet 内 input/category/tag 编辑回调透传；error 展示
- [ ] 更新 `Shell.test.tsx`：移动端 timer 页 header 显示标题而非 TimerBar；
  dock 插槽渲染；非 timer 页不渲染 dock。
- [ ] 检查 `App.test.tsx` 是否有移动端断言需要更新。

### 4. 全量校验
- [ ] `cd web && npm run check`（或项目等价：lint + vitest + tsc）全绿。
- [ ] 桌面端手测（≥768px）：timer 页 header 内 TimerBar 行为不变。
- [ ] 移动端手测（<768px 视口）：胶囊常驻、sheet 编辑、运行中标签、停止后草稿重置。

## 验证命令

```bash
cd web && npx vitest run src/components/MobileTimerDock.test.tsx src/components/Shell.test.tsx src/App.test.tsx
cd web && npm run check
```

## 回滚点

- 单分支单 PR，revert 即回滚；无数据库/API/schema 变更。

## Review gates

- 实现 dispatch（trellis-implement）→ check dispatch（trellis-check）→ 3.3 spec 更新
  （component-guidelines.md 的 Shell/TimerBar 段落需补移动端停靠胶囊契约）→ commit。
