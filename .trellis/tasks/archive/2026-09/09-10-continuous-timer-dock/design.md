# 无间隙计时适配移动端停靠胶囊 — 技术设计

## 核心思路

复用现有 `categoryPickerAutoOpen` 状态作为唯一信号源，不新增状态：

```
onToggle (无间隙停止)
  → setCategoryPickerAutoOpen(true)
  → barProps.autoOpenEditor = categoryPickerAutoOpen
  → MobileTimerDock: <Sheet open={sheetOpen} onOpenChange={...}>
      sheetOpen = autoOpenEditor ? true : userClosedRef ? ... 
```

### MobileTimerDock 的受控 open 策略

- Sheet 改为**受控**：内部 state `sheetOpen`，初始 false。
- 打开条件：`autoOpenEditor === true` 时强制打开（派生：
  `const sheetOpen = props.autoOpenEditor || manualOpen`，其中 `manualOpen` 是用户
  点击摘要区的手动打开状态）。
  简化实现：单一 state `open`，`open = manualOpen || props.autoOpenEditor` 不引入
  useEffect 同步——autoOpenEditor 从 false→true 直接使 render 输出 open=true。
- 关闭复位：`onOpenChange(false)` 时：
  - `setManualOpen(false)`
  - 若 `props.autoOpenEditor` 仍为 true，需要通知 hook 复位信号 → `barProps` 需要一个
    回调 `onAutoOpenConsumed()`（hook 内 `setCategoryPickerAutoOpen(false)`）。
- 选中分类路径：`CategoryPicker` onChange → 现有 `setCategoryPickerAutoOpen(false)` →
  `autoOpenEditor` 变 false → sheet 自动关闭（无需额外关闭逻辑，纯派生）。
- 用户手动关闭路径：Sheet `onOpenChange(false)` → 若 `props.autoOpenEditor` 为 true
  则调 `props.onAutoOpenConsumed()` 复位信号 → sheet 关闭、状态干净。

### hook 侧改动（`use-timer-controller.tsx`）

`barProps` 新增：

```ts
autoOpenEditor: categoryPickerAutoOpen,
onAutoOpenConsumed: () => setCategoryPickerAutoOpen(false),
```

`TimerBar` 不消费这两个字段（spread 传入，无 excess prop 检查问题，与
`categoryColor` 同模式）。

### 时序细节

- 无间隙停止 → `api.stop()` resolve → `onCurrent(entry)` + `setCategoryPickerAutoOpen(true)`
  同一批 setState → 下一次 render `autoOpenEditor=true` → sheet 打开（Radix Sheet 受控
  open，无动画延迟问题）→ sheet 内 `CategoryPicker` mount 时 `open={true}` → 下拉弹出。
- 唯一注意点：Radix DropdownMenu 在 Sheet（Dialog）modal 内弹出——#51 已验证
  modal-in-modal 可行（EntryEditor sheet 内同样用 CategoryPicker 下拉），
  jsdom 测试用 `PointerEventsCheckLevel.Never`。

## 测试计划

`use-timer-controller.test.tsx`：
- 无间隙停止后 `barProps.autoOpenEditor === true`；选分类回调后变 false。

`MobileTimerDock.test.tsx` 新增用例：
- `autoOpenEditor=true` 初始渲染 → sheet 已打开、分类下拉已展开（dialog + menu 角色）。
- 选分类（模拟 CategoryPicker onChange，用 stub pickers）→ onAutoOpenConsumed 被调用
  （实际关闭由 hook 状态驱动，组件测试断言回调即可）。
- `autoOpenEditor=true` 时用户关闭 sheet → onAutoOpenConsumed 被调用。
- `autoOpenEditor=false`（初始）→ sheet 关闭，点摘要区正常手动打开不受影响。

## 回滚

单提交 revert；无 schema/API/token 变更。
