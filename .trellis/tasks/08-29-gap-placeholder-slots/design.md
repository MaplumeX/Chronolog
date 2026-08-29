# Design: Timeline gap placeholder slots

## 0. 需求回放（已与用户确认）

- 「两个已有条目」按**全部数据**判定，非当前视图可见条目。
- 插槽样式：虚线边框 + 灰色（半透明）内部，**静态可见**（非 hover 出现）。
- 空档像素高度低于阈值 → 不渲染插槽。
- 点击插槽 → EntryEditor 预填**整个空档**的起止时间（复用 draft popover 流程）。
- 跨天 gap 两边各一个插槽（前日列尾部 + 后日列头部）；多天空档自然推广（中间日整列一个）。
- 日视图同样显示边界插槽：当天第一条之前 / 最后一条之后的空档，以外日条目为边界。

## 1. 边界与不做的事

- **不改** 拖拽创建（`onDragCreate`）、点击编辑（block `onClick`）、选中 popover、EntryEditor 表单逻辑。
- **不改** 后端校验（overlap 409 等）；新条目仍走 `POST /api/entries`。
- 插槽是纯展示层 + 一个 click 入口，不产生新实体/新表。

## 2. Gap 计算放在哪一层

**前端 `Timeline.tsx` 内计算**，数据来源是新的相邻条目信息（见 §3）。

理由：gap 只影响 timeline 渲染；slot 点击后走的创建链路（draft popover → `api.createEntry`）已存在。后端只补「窗口外相邻条目」的查询。

## 3. 数据获取：`GET /api/entries/boundary`

新增轻量后端接口，返回**查询窗口的紧邻外侧条目**：

```
GET /api/entries/boundary?tz=Asia/Shanghai&start=<ISO>&end=<ISO>
→ { tz, prevEntry: EntryDto | null, nextEntry: EntryDto | null }
```

- `prevEntry`：`startedAt < start` 且（`stoppedAt IS NULL` 或 `stoppedAt <= start`）的条目中，取**实际覆盖区间右端**（`stoppedAt ?? ∞`）最大的一条。半开区间语义：`stoppedAt == start` 视为前邻（相接不算重叠，gap 为 0，插槽因高度不足自然不显示）。
- `nextEntry`：`startedAt >= end` 的条目中 `startedAt` 最小的一条。
- 复用 `entrySelect` + `attachTags`，返回完整 `EntryDto`（前端只需要起止时间，但复用 DTO 免得再开一套 shape）。
- `start` / `end` 为 ISO 时刻，**不含时区推导**——由前端把 day/week 窗口转成绝对时刻传入，后端不做 tz 窗口计算（区别于 today/week 接口的 `date` 参数）。参数用 zod 校验 `z.iso.datetime()`，`start < end` 否则 400。
- 归属：放在 `routes/entries.ts`（共享 entries 资源），查询 helper 放 `entries.ts`。

调用时机（`use-timer-controller.tsx`）：

- `refresh()`、`onDateChange()`、`onModeChange()`、`onToggle()`、`refreshEntries()` 中，与 today/week 拉取**并行**请求 boundary（窗口 = 当前视图窗口：day → `[dayStart, dayEnd]`，week → `[weekStart, weekEnd]`），存入 `boundary` state，随 `timelineProps` 下发。
- 失败静默（`catch(() => undefined)`）——插槽是增强功能，不能阻塞主数据加载。

> 备选方案（否决）：前端多拉一天 today 数据（日视图）+ 周首前/周尾后（周视图）——请求更重（拉全量 entries + tags），且 week 模式下需要 3 次额外请求；boundary 接口单请求、payload 极小（最多 2 条）。

## 4. Gap 与 Slot 的计算（前端）

新增纯函数（放 `Timeline.tsx` 或 `format.ts` 旁的模块），输入：

```
computeGaps(
  window: { startMs, endMs },        // 当前列的可见窗口
  entries: TimeEntry[],              // 该列（当天窗口内）的条目，含 clipped 边界
  boundary: { prevEntry, nextEntry } // 窗口紧邻外侧条目
): Gap[]
```

`Gap = { startMs, endMs }`（**全局绝对时刻**，可跨天/跨多天）：

1. 列内相邻条目之间：`max(prev.stoppedAt ?? nowMs, dayStart)` → `min(next.startedAt, dayEnd)`，与窗口求交，空/负则跳过。
2. 列顶部：`prevEntry` 存在时，`max(prevEntry.stoppedAt ?? -∞, dayStart)` → 当天第一条的 `startedAt`。
   - 注意 `prevEntry.stoppedAt` 可能**伸入当天窗口**（跨午夜条目被裁剪进本列）——此时它已在 `day.entries` 里（clipped > 0），顶部 gap 起点会被它顶住，公式自动正确。
3. 列底部：`nextEntry` 存在时，当天最后一条覆盖区间的右端 → `min(nextEntry.startedAt, dayEnd)`。
4. 空列（当天无条目）：`prevEntry` 或 `nextEntry` 任一存在时，整列一个 gap（`dayStart → dayEnd`，若两侧都存在则就是一个跨多天空档的中间投影）。
5. 运行中条目（`stoppedAt == null`）按 `nowMs` 作为右端参与计算（它不可能有后继，同用户唯一 running）。

**同一个全局 gap 在多列出现时**（如 Tue 23:00–Thu 10:00 空 24h）：各列各自渲染自己的可见投影段，点击任何一段都生成**同一个** `{ startedAt: gap.startMs, stoppedAt: gap.endMs }` draft——这正是用户要的行为。

Slot 渲染阈值：gap 可见段换算像素（`innerHeightFor(scale)` 比例）`< MIN_SLOT_PX`（实现时校准，预计 8–12px）则该段不渲染。

## 5. 渲染与交互（`DayColumn`）

- `DayColumn` 新增 props：`gaps: Gap[]`、`onGapClick(gap: Gap)`。
- 每个可见 gap 段渲染一个 `div.timeline-slot`：绝对定位（同 block 的 top/height 百分比算法），样式在 `styles.css` 新增——虚线边框（`border: 1px dashed var(--border)` 系）、灰色半透明内部（`bg-muted/30` 系 token）、`cursor-pointer`、圆角与 block 一致。**不要**硬编码颜色，遵守 design tokens 规范。
- slot 内不渲染文字（太矮放不下）；`title` 属性给 `HH:MM – HH:MM（时长）`提示（i18n 可后补）。
- `onPointerDown` 早退：现有拖拽创建的 pointerdown 已用 `closest(".timeline-block")` 过滤 block 点击——slot 需同样处理（`closest(".timeline-slot")` 也跳过），保证点 slot 不触发拖拽预览。
- 点击 slot → `Timeline` 层设置既有 draft state `{ dayStart, startedAt, stoppedAt }`（`startedAt/stoppedAt` 直接用 gap 的全局时刻，跨天也照传；后端本就不限制窗口，`dayStart` 仅用于 week 模式的 anchor 归属）→ 复用现有 draft popover（`EntryEditor` draft 模式）。
- draftAnchor：slot 点击不走拖拽预览块，直接以 slot 元素做 popover anchor——实现上给被点击的 slot 加 `PopoverAnchor`（与选中 block 相同手法）。简化：点击后 slot 保持渲染（gap 数据未变），anchor 钉在 slot 中心。

## 6. 兼容与回滚

- boundary 请求失败 → `boundary = null` → 只渲染列内 gap（无顶部/底部插槽），主功能无损降级。
- 全部改动集中在：`server/src/{entries.ts, routes/entries.ts}`（新查询 + 路由）、`web/src/api.ts`（类型 + 方法）、`web/src/hooks/use-timer-controller.tsx`（拉取 + 下发）、`web/src/components/Timeline.tsx`（计算 + 渲染 + 点击）、`web/src/styles.css`（slot 样式）、`web/src/i18n/*`（可选 title 文案）。
- 回滚 = revert 单个 commit，无 schema/迁移变更。

## 7. 测试

- 后端（`server/test/`，node:test + inject，参照 today.test.ts）：boundary 接口——prev/next 各自取最近、窗口内条目不返回、running 条目作 prev（stoppedAt null）、`stoppedAt == start` 相接、`start >= end` 400、tz/datetime 校验、空结果两 null。
- 前端：`computeGaps` 纯函数单测（若项目无前端测试基建，则以 typecheck + 手动验收覆盖，验收清单写进 implement.md）。
- 手动验收：AC1–AC7。
