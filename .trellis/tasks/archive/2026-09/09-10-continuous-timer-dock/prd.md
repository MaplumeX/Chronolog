# 无间隙计时适配移动端停靠胶囊

## Goal

修复 09-10-mobile-timer-dock 引入的缺陷：无间隙模式（continuous timing）下停止换段后的
`categoryPickerAutoOpen` 引导信号在移动端停靠胶囊上被静默吞掉。移动端需在换段成功后
自动展开 `MobileTimerDock` 的编辑 sheet（内含自动弹出的分类下拉），用户选完分类后
sheet 自动关闭。

## Background

- 无间隙计时的既有设计：点停止 → 服务端返回新段（`stoppedAt === null`，继续计时）→
  `setCategoryPickerAutoOpen(true)` → `barProps.categoryPicker`（`CategoryPicker` 受控
  `open`）自动展开分类下拉，引导给新段选分类。
- 桌面端 `TimerBar` 的 categoryPicker 常驻顶栏，该流程正常。
- 移动端改造后 categoryPicker 只存在于 `MobileTimerDock` 的 bottom sheet 内，sheet 关闭时
  Radix 不挂载内容，`open={true}` 的 DropdownMenu 不在 DOM 中——引导信号失效，
  用户换段后无任何提示，可能整段未选分类。

## Scope

- **In scope**
  - `use-timer-controller.tsx`：把 auto-open 信号（现有 `categoryPickerAutoOpen` 状态或
    等价派生字段）暴露进 `barProps`
  - `MobileTimerDock.tsx`：受控 `Sheet open`，换段时自动展开；用户选完分类（或主动
    关闭）后关闭并复位信号
  - 对应测试
- **Out of scope**
  - 桌面端 TimerBar（现有 `open` 透传行为不变）
  - 无间隙模式的服务端逻辑、`api.stop()` 语义
  - sheet 内容/样式本身

## Requirements

### R1 信号暴露
- `barProps` 新增字段（如 `autoOpenEditor: boolean`，或直接透传
  `categoryPickerAutoOpen`），桌面端 `TimerBar` 忽略多余字段，行为不变。

### R2 移动端自动展开
- 无间隙换段成功后（信号为 true 时），`MobileTimerDock` 的编辑 sheet 自动打开；
  sheet 内 `CategoryPicker` 沿用现有受控 `open` 逻辑接着自动弹出下拉。
- 用户选中分类后：现有 onChange 已复位 `categoryPickerAutoOpen` → sheet 同步关闭。
- 用户未选分类直接关闭 sheet（Esc/点遮罩/drag-handle）：信号复位，不残留——
  下次换段仍能正常触发（现有 `if (!running) setCategoryPickerAutoOpen(false)`
  不受影响）。
- 普通模式停止（完全停止）与其他页面切换不触发 sheet。

### R3 桌面端回归
- 桌面端 `TimerBar` 分类下拉自动展开行为与改动前一致。

## Acceptance Criteria

- [ ] 无间隙停止换段后，移动端编辑 sheet 自动打开且分类下拉已弹出
- [ ] 选中分类后 sheet 自动关闭、信号复位
- [ ] 未选分类手动关闭 sheet，信号复位，再次换段仍可触发
- [ ] 普通停止/切页不触发 sheet；桌面端 auto-open 行为不变
- [ ] `typecheck + test + build` 全绿

## References

- `web/src/hooks/use-timer-controller.tsx`（onToggle 无间隙分支、categoryPickerAutoOpen）
- `web/src/components/MobileTimerDock.tsx`（sheet 受控改造）
- `web/src/components/CategoryPicker.tsx`（受控 open 透传）
