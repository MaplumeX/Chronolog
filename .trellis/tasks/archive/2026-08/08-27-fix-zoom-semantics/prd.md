# Fix zoom +/- semantics and remove scale label

## Background

Timeline 缩放切换器（`web/src/components/Timeline.tsx`，commit e279e8d 引入）目前语义颠倒：
- `+`（Plus）按钮调用 `setScale(SCALES[scaleIndex - 1])`，即调粗刻度（60 分钟），视觉上是缩小
- `-`（Minus）按钮调用 `setScale(SCALES[scaleIndex + 1])`，即调细刻度（5 分钟），视觉上是放大

正确的 zoom 语义应为：`+` = zoom in（放大）= 刻度值减小（60→30→15→5），`-` = zoom out（缩小）= 刻度值增大。

同时用户要求删掉中间显示当前刻度的 `<span>`（如 "60 分钟刻度"）。

## Requirements

1. 交换 +/− 按钮的语义：
   - `+` 按钮 → zoom in → `scaleIndex + 1`（刻度减小：60→30→15→5），在 `scaleIndex === SCALES.length - 1` 时 disabled
   - `-` 按钮 → zoom out → `scaleIndex - 1`（刻度增大：5→15→30→60），在 `scaleIndex === 0` 时 disabled
2. 删除两个按钮之间的刻度显示 `<span>`（`timeline.scaleLabel`）
3. 更新 i18n aria-label 语义：
   - `+` 按钮用 "Zoom in" / "放大"
   - `-` 按钮用 "Zoom out" / "缩小"
   - 删除不再使用的 `timeline.scaleLabel` 键

## Acceptance Criteria

- [ ] 点击 `+`：刻度从 60 → 30 → 15 → 5，最细（5）时 `+` disabled
- [ ] 点击 `-`：刻度从 5 → 15 → 30 → 60，最粗（60）时 `-` disabled
- [ ] 按钮之间不再显示刻度文字
- [ ] aria-label 语义正确（zoom in / zoom out），无残留未使用的 i18n key
- [ ] typecheck / build 通过

## Notes

- 单文件 UI 修正，轻量任务（PRD-only）