# 无间隙计时适配移动端停靠胶囊 — 执行计划

## 步骤

### 1. hook 信号暴露
- [ ] `use-timer-controller.tsx`：`barProps` 新增 `autoOpenEditor: categoryPickerAutoOpen`
      与 `onAutoOpenConsumed: () => setCategoryPickerAutoOpen(false)`；业务逻辑零改动。
- [ ] `use-timer-controller.test.tsx`：补无间隙停止 → `autoOpenEditor` true、
      选分类 → false 的断言（若无间隙已有用例则扩展之）。

### 2. MobileTimerDock 受控 sheet
- [ ] `MobileTimerDock.tsx`：props 新增 `autoOpenEditor: boolean`、`onAutoOpenConsumed: () => void`；
      内部 `manualOpen` state，`open = manualOpen || props.autoOpenEditor`；
      `onOpenChange(false)` 时 `setManualOpen(false)` 且 `props.autoOpenEditor` 为 true 时
      调 `onAutoOpenConsumed()`。
- [ ] `MobileTimerDock.test.tsx` 新增用例（见 design.md 测试计划）：
  - autoOpenEditor=true → sheet 打开
  - 手动关闭时 onAutoOpenConsumed 被调用
  - autoOpenEditor=false → 手动打开/关闭不受影响、不调 onAutoOpenConsumed

### 3. 全量校验
- [ ] `cd web && npm run typecheck && npm test && npm run build` 全绿。
- [ ] 桌面端回归推演：TimerBar 不消费新字段，auto-open 行为不变。

## 验证命令

```bash
cd web && npx vitest run src/components/MobileTimerDock.test.tsx src/hooks/use-timer-controller.test.tsx src/components/TimerBar.test.tsx 2>/dev/null || npx vitest run src/components/MobileTimerDock.test.tsx src/hooks/use-timer-controller.test.tsx
cd web && npm run typecheck && npm test && npm run build
```

## 回滚点

单提交 revert；无 schema/API/token 变更。

## Review gates

- trellis-implement → trellis-check → spec 增量更新（component-guidelines.md 停靠胶囊
  段落补 autoOpenEditor 契约）→ commit。
