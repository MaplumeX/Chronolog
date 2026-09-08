# PRD: 记忆时间线视图偏好（天/周视图 + 比例档位）

## 背景

Timer 页时间线有两个用户可切换的偏好，目前均为硬编码默认值、不做持久化，刷新/重进后丢失：

1. **视图模式**（`view`，"day" | "week"）：`use-timer-controller.tsx` 中 `useState("day")`
2. **比例档位**（`scale`，60/30/15/5）：`Timeline.tsx` 中 `useState<Scale>(60)`

项目已有同类先例：查看日期（`chronolog-date-view`）、主题（`use-theme.ts`）、语言（`i18n/index.ts`）均通过 localStorage 持久化，且在隐私模式（localStorage 不可用）下静默降级。

## 需求

- 用户切换天/周视图后，偏好被持久化；下次进入 Timer 页恢复上次的视图模式。
- 用户切换比例档位（放大/缩小）后，偏好被持久化；下次进入恢复上次的档位。
- 垃圾值（非法枚举值）视为无记录，回退默认值（day / 60）。
- localStorage 不可用（隐私模式等）时静默降级：仅内存态生效，不报错。
- 仅前端改动，不涉及后端 API / schema。

## 非目标

- 不持久化其他时间线状态（选中条目、草稿、滚动位置等）。
- 不做跨设备同步（不落库、不做用户设置接口）。

## 验收标准

1. 切到周视图 → 刷新页面 → 仍为周视图；切回天视图同理。
2. 比例调到非默认档位（如 15）→ 刷新 → 仍为该档位。
3. localStorage 中写入垃圾值（如 `"month"` / `"7"`）后加载 → 回退默认（day / 60），不崩溃。
4. 两个偏好相互独立，各自持久化。
5. 现有测试全部通过；为持久化逻辑补充单元测试（参照 `use-timer-controller.tsx` / `Timeline.test.tsx` 现有测试风格）。

## 涉及文件

- `web/src/hooks/use-timer-controller.tsx` — view 持久化（照搬 `DATE_VIEW_KEY` 模式）
- `web/src/components/Timeline.tsx` — scale 持久化
