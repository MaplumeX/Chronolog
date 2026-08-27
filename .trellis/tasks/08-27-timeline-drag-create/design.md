# Design: Timeline drag-to-create entry

## 总体结构

三个改动面，互相独立可测：

1. **后端**：新增 `POST /api/entries`，复用 `PATCH /api/entries/:id` 的校验链。
2. **API client**：`web/src/api.ts` 增加 `createEntry`。
3. **前端交互**：`Timeline.tsx` 增加拖拽创建 + `EntryEditor` 支持草稿（无 id）模式。

## 后端

### `POST /api/entries`（`server/src/routes/entries.ts`）

- Body schema 复用 `updateBody`（zod）：`{ description, categoryId, tagIds, startedAt, stoppedAt }`，全部必填（description 允许空串，trim 后 ≤200）。
- 校验链与 PATCH 相同，顺序保持一致：
  1. `stoppedAt > startedAt` → 400 `VALIDATION`（无 id 可查，无需 404/409-CONFLICT 分支）
  2. 分类归属 → 404
  3. 标签归属 → 404
  4. 重叠检测（半开区间，running 条目延伸到无穷）→ 409 `OVERLAP`
- 插入 `{ id: newId(), userId, categoryId, description, startedAt, stoppedAt }` + entryTags。
- 返回 `getEntry(...)`（`EntryDto`，201）。`web/src/api.ts` `TimeEntry` 已对齐 EntryDto，无需改类型。
- **不做** day 窗口约束（PRD R6 的 [dayStart, dayEnd) 限制定为前端职责，见下）。
- 提取共享的校验+标签回写逻辑为 `applyEntryUpsert(tx, userId, { id?, ...body })`（或平铺两个函数共享子函数，避免过度抽象）。

### 单测（`server/test/entries.test.ts` 追加）

- 正常创建 → 201，返回 EntryDto，`GET /api/entries/today` 可见。
- `stoppedAt <= startedAt` → 400。
- 未分类 / 他人分类 → 404；他人 tag → 404。
- 与已有条目重叠 → 409 `OVERLAP`；边界相接不冲突（半开区间）。
- 跨用户隔离：用 B 用户 id 创建 → 404。

## 前端

### api.ts

```ts
createEntry: (body: { description; categoryId; tagIds; startedAt; stoppedAt }) =>
  request<TimeEntry>("/api/entries", { method: "POST", body: JSON.stringify(body) })
```

### EntryEditor：支持草稿模式

- Props 改为 `entry: TimeEntry | { startedAt; stoppedAt; categoryId: ""; ... }` 的草稿形状。实现上最简单：新增可选 prop `draft?: { startedAt: string; stoppedAt: string }`，或让父组件构造一个假 `TimeEntry`（id 为空串）。**选前者**（显式 `mode`），避免假 id 散逸：
  - `props.entry`（编辑模式）或 `props.draft`（新建模式）二选一。
  - 新建模式：categoryId 初始为 `""`，保存调用 `api.createEntry`；后端 zod `categoryId: min(1)` 会拒绝空值，但前端也应阻止提交（按钮禁用），错误信息用 i18n key。
  - OVERLAP 错误处理与编辑模式相同（显示 `entry.overlap`）。

### Timeline.tsx：拖拽创建

- `DayColumn` 增加 props：`onDragCreate?: (draft: { startedAt: string; stoppedAt: string }) => void`，由 Timeline 提供；未提供时不启用（保持向后兼容）。
- 在 `timeline-track` div 上监听 `onPointerDown`：
  - 若 `e.target` 命中 `.timeline-block`（`e.target.closest()`），直接 return —— 不干扰色块点击（R7）。
  - `setPointerCapture`，记录 `startMs`（snap 后）。
  - `onPointerMove`：计算当前时间 → snap → 更新预览 state `{ startMs, endMs }`（起止自动排序，支持向上拖）。
  - `onPointerUp`：若从未离开过起始 snap 格（点击），取消；否则回调 `onDragCreate` 并清理。
- 像素→时间换算：`track.getBoundingClientRect()` + `innerHeightFor(scale)`；`ms = dayStartMs + (y / height) * dayMs`，clamp 到 `[dayStartMs, dayEndMs]`。
- snap 函数：`gridMs = scale * 4 * 60000`（60→15min, 30→10min, 15→5min, 5→1min，即 `scale` 分钟×4……实际是 60/scale×(scale/4)？—— 直接写映射表 `{60: 15, 30: 10, 15: 5, 5: 1}` 分钟）。snap = `Math.round(ms / gridMs) * gridMs`；起止都 snap 后若相等，则 `endMs = startMs + gridMs`（R4 不足一格按一格）。
- 预览块：`timeline-track` 内条件渲染 `.timeline-block.drag-preview`（半透明，absolute 定位同条目色块），显示 `HH:MM – HH:MM`。样式加到 `styles.css`。
- 草稿状态提升到 `Timeline`（`draft: { dayStart, startedAt, stoppedAt } | null`）：week 模式下每列都能发起，需要知道归属哪一天。Popover/EntryEditor 渲染复用现有结构，新增一个 `draft != null` 分支。

### i18n

- 新 key：`entry.createTitle`（如"新建条目"）、`entry.selectCategoryRequired`（"请选择分类"）、`timeline.dragToCreate`（如有 aria/title 需要）。zh/en 同步。

## 兼容性 / 回滚

- `POST /api/entries` 是纯新增端点，无迁移；回滚 = 移除前端入口。
- `DayColumn` 未传 `onDragCreate` 时行为与现状完全一致。
- 不改 DB schema。

## 已知取舍

- **不做 day 窗口服务端约束**：拖拽天然受列范围限制（clamp 到 [dayStart, dayEnd]），编辑器里用户手改时间的场景由 PATCH 既有校验覆盖（无窗口限制，与现状一致）。
- **预览块不做重叠提示**：重叠在保存时由后端 409 拒绝并展示（与编辑条目行为一致，AC4）。
- **触屏**：pointer events 天然支持，但不做长按/滚动冲突优化（Out of Scope）。