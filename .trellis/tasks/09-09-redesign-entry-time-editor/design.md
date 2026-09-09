# 技术设计：紧凑行内时间编辑组件（方向 C）

## 架构与边界

### 新组件 `EntryTimeRangeEditor`

新文件 `web/src/components/EntryTimeRangeEditor.tsx`，自包含承担方向 C 的全部交互：

```
EntryEditor（瘦身为纯装配层）
  └── EntryTimeRangeEditor   ← 新组件，承接时间编辑全部职责
        ├── 紧凑行：[开始槽] → [结束槽] · [时长槽]
        ├── 展开面板（同一时刻至多一个）
        │     ├── start/end：TimeField(time input) + DateAdjust(Calendar popover)
        │     └── duration：DurationInput + 快捷时长 chips + 「到现在」
        └── 派生数据：duration、sameDay、invalid（展示层）
```

- **props 契约**（value/onChange 受控模式，与现 `DateTimePicker` 一致风格）：
  ```ts
  {
    startedAt: string;              // "YYYY-MM-DDTHH:mm:ss" 本地时间
    stoppedAt: string;
    onStartChange: (v: string) => void;
    onStopChange: (v: string) => void;
  }
  ```
  状态所有权仍在 `EntryEditor`（`startedAt`/`stoppedAt` useState），新组件纯受控，便于测试与迁移。
- `EntryEditor` 删除两个 `DateTimePicker` 块与只读时长行，替换为单行 `<EntryTimeRangeEditor />`；`toLocalInput` 等序列化逻辑保留在 `EntryEditor`（序列化与编辑解耦）。
- 保存校验（end ≤ start 拒绝）在 `EntryEditor.onSave` 中实现（现状 `Number.isNaN` 分支旁扩展），新组件不负责校验 —— 校验是“保存动作”的守卫，不是编辑组件的职责。

### 组件内部结构

- `editing: "none" | "start" | "end" | "duration"` 本地 state 控制唯一展开面板（点击已展开槽位收起）。
- 复用项目既有 UI 原语：`Button`、`Input`（time input）、`Label`、`Popover` + `Calendar`（react-day-picker）。
- 时长解析函数 `parseDurationInput`（`H:MM:SS` / `H:MM` / `Nm` / `N.Nh` / `Ns`）作为组件文件内纯函数导出，便于单测。
- 时长编辑以开始时间为锚反推结束：`end = start + duration`。
- 日期调整（DateAdjust）：点选日历后替换对应端的日期部分、保留时间部分，随后关闭 popover（demo C 已验证的行为）。
- 「现在」按钮不加入开始/结束面板（OQ2 决策：删除）；时长面板保留「到现在」（`end = now`）。

## 数据流

```
Timeline popover (w-80)
  └─ EntryEditor state: startedAt/stoppedAt (string, 本地格式)
       └─ EntryTimeRangeEditor (受控)
            slot 点击 → setEditing(k) → 面板渲染
            time input change → onStartChange/onStopChange("YYYY-MM-DDTHH:mm:ss")
            duration 提交 → parse → onStopChange(start + dur)
保存: EntryEditor.onSave → Date.parse 校验 + end≤start 硬校验 → api
```

不变式：props 值始终是合法本地格式串（输入路径均由 time input / Calendar / parse-duration 生成，不产生半成品）；end < start 仅在用户编辑过程中瞬时存在，保存被拦截。

## 兼容性

- 新建草稿模式（draft）：`EntryEditor` 现有 draft 分支不变，新组件拿到的初值即拖拽位置时间，无特判。
- `Timeline.tsx` 无需改动（EntryEditor props 不变）。
- 后端 API 契约不变（`startedAt`/`stoppedAt` 仍为 ISO-Z，由 `EntryEditor` 序列化）。
- `DateTimePicker.tsx` 删除（R8，唯一调用方为 EntryEditor）。
- i18n：新增 key（见下）加入 `zh.ts` / `en.ts`，`en` 为 `Record<keyof typeof zh, string>` 类型约束，缺 key 会编译报错。

## 权衡记录

- **展开式面板 vs 嵌套 popover**：demo C 用卡片内展开（div + border），不用 popover 套 popover（日历弹层除外）。弹层嵌套在 w-80 父 popover 内层级与关闭行为复杂，展开式更稳，也避免移动端双层弹层。
- **保存时校验（OQ1=a）而非编辑时联动**：编辑器只处理已停止条目（`Timeline.tsx:370` 运行中不可点击），非法状态仅在用户编辑过程中瞬时存在；硬校验 + 复用 `entry.invalidTime` 文案最轻量可预期。
- **时长输入即时 vs 提交制**：采用提交制（Enter / 快捷键/「到现在」），非法输入不落地（R6），避免每击键反推导致结束时间跳变。
- **`entry.now` key 的去留**：现 key 被 DateTimePicker「现在」按钮独占使用；按钮删除后 key 一并删除（en/zh 同步）。

## 回滚

- 组件为纯前端改动、无数据迁移：回滚 = revert 该 commit。
- 实现按 implement.md 分步提交（组件 → 接线 → 清理 demo），任一步可独立回退。

## i18n key 草案

| key | zh | en |
|---|---|---|
| `entry.timeRange.start` | 开始 | Start |
| `entry.timeRange.end` | 结束 | End |
| `entry.timeRange.duration` | 时长 | Duration |
| `entry.timeRange.startAria` | 编辑开始时间 | Edit start time |
| `entry.timeRange.endAria` | 编辑结束时间 | Edit end time |
| `entry.timeRange.durationAria` | 编辑时长 | Edit duration |
| `entry.timeRange.startDate` | 开始日期 | Start date |
| `entry.timeRange.endDate` | 结束日期 | End date |
| `entry.timeRange.durationPlaceholder` | 如 1:30:00 或 90m | e.g. 1:30:00 or 90m |
| `entry.timeRange.untilNow` | 到现在 | Until now |
| `entry.invalidRange` | 结束时间必须晚于开始时间 | End time must be after start time |

（`entry.duration` 等现有 key 继续复用；最终 key 集在实现时按实际文案微调，保持 zh/en 同步。）
