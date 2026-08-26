# 时间线条目可点击编辑（popover）— 技术设计

## 架构与边界

- 后端：新增 `PATCH /api/entries/:id` 全量更新接口（新建 `server/src/routes/entries.ts`，在 `app.ts` 注册）。
- 前端：新增 `web/src/components/ui/popover.tsx`（radix-ui Popover 原语，shadcn 风格）+ `web/src/components/EntryEditor.tsx`（popover 内容表单）；`Timeline.tsx` 增加点击与锚定逻辑；`api.ts` 增加 `updateEntry`。

## 后端设计

### 接口契约

```
PATCH /api/entries/:id
Body: {
  description: string,   // trim 后可为空，max 200
  categoryId: string,
  tagIds: string[],     // 可空数组
  startedAt: string,     // ISO 8601 UTC
  stoppedAt: string,     // ISO 8601 UTC，必须 > startedAt
}
Response: { entry: EntryDto }   // 复用 getEntry
```

全量更新（前端总是提交所有字段），避免部分更新语义。

### 校验顺序（事务内）

1. 条目存在且 `userId` 匹配 → 否则 404 `NOT_FOUND`。
2. 条目必须已停止（`stoppedAt` 非 null）→ 否则 409 `CONFLICT`（运行中不可编辑）。
3. `categoryId` 存在且属于用户 → 否则 404。
4. `tagIds` 全部存在且属于用户 → 否则 404（复用 timer.ts 的 owned 检查模式）。
5. `stoppedAt > startedAt` → 否则 400 `VALIDATION`。
6. 重叠校验（半开区间 `[start, end)`，边界相接不算重叠）：
   ```sql
   other.startedAt < newStoppedAt AND (other.stoppedAt IS NULL OR other.stoppedAt > newStartedAt)
   ```
   排除自身（`id != :id`）。运行中条目（`stoppedAt IS NULL`）视为延伸到无穷，参与冲突检测。
   命中 → 409 `OVERLAP`。

### 数据更新（事务）

- `timeEntries`：更新 description、categoryId、startedAt、stoppedAt。
- `entryTags`：删除该条目全部旧关联，插入新 tagIds（参考 timer.ts `startOnce` 的事务模式）。
- 返回 `getEntry(deps.db, user.id, id, deps.now())`。

### 错误码约定

| 场景 | 状态码 | code |
|---|---|---|
| 条目/分类/标签不存在或非本人 | 404 | NOT_FOUND |
| 运行中条目 | 409 | CONFLICT |
| 时间区间非法 / 描述超长 / 格式错误 | 400 | VALIDATION |
| 与其它条目重叠 | 409 | OVERLAP |

## 前端设计

### Popover 定位方案（关键决策）

用 **Radix Popover + `Popover.Anchor` 包裹被点击的 block**：

- `Timeline` 顶层渲染 `<Popover.Root open={!!selected} onOpenChange={...}>`，`Popover.Content` 在 Root 内。
- `DayColumn` 渲染 block 时，若 `selected?.id === e.id`，用 `<Popover.Anchor asChild>` 包裹该 block（Anchor 在 Root 的组件子树内，合法）。
- Floating UI 基于 anchor 自动定位 Content（`side="right" align="start"`），滚动时自动跟随（Radix 默认 autoUpdate）。
- 关闭：点击外部 / Esc / 保存成功 / 数据刷新后条目消失（Anchor 卸载 → Content 自动关闭）。

### 时间输入

- 表单用 `<input type="datetime-local" step="1">`（保留秒精度，避免只改描述时秒被截断）。
- 转换：ISO → 本地 `YYYY-MM-DDTHH:mm:ss`（浏览器本地时区）；本地 → `new Date(value).toISOString()`。
- 编辑用浏览器本地时区（与 TimerBar 的"现在"一致），不引入 tz 参数。

### 组件与数据流

```
TimerPage (categories, tags, today, week)
  └─ Timeline (新增 props: categories, tags, onEntryUpdated)
       ├─ DayColumn ×N (block onClick → setSelected; Anchor 包裹选中 block)
       └─ Popover.Content → EntryEditor (entry, categories, tags, onSaved, onClose)
```

- `EntryEditor`：表单 state = description / categoryId / tagIds / startedAt / stoppedAt（本地时间字符串）；显示时长（实时按表单时间计算）；保存 → `api.updateEntry` → `onSaved()`；错误显示 `ApiError.message`；保存中禁用按钮。
- `TimerPage`：新增 `refreshEntries()`（只拉 today + week，不重置开始计时表单），传给 `onEntryUpdated`；保存成功后调用并关闭 popover。
- 运行中条目：block 不设 onClick（不可点击）。

### i18n 新增文案（zh/en 双语）

`entry.edit` / `entry.description` / `entry.category` / `entry.tags` / `entry.startTime` / `entry.endTime` / `entry.duration` / `entry.save` / `entry.cancel` / `entry.saveFailed` / `entry.overlap`（409 提示）。

## 兼容性与回滚

- 纯增量：新路由 + 新组件，不改现有接口/表结构；`timeEntries` 表无迁移。
- 回滚：撤销 commit 即可；旧前端对新接口无感知。
- 重叠校验只作用于编辑接口，不影响现有 start/stop 流程（历史重叠数据不受影响）。

## 权衡记录

- **全量更新 vs 部分更新**：全量更简单，校验路径单一；前端总是提交完整表单。
- **允许重叠 vs 禁止**：用户选择禁止；边界相接（==）不算重叠，与半开区间语义一致。
- **Radix Popover vs 自实现**：Radix 免费获得点击外部关闭、Esc、焦点管理、滚动跟随；Anchor 方案避免手动定位。
- **datetime-local 分钟精度 vs 秒精度**：用 step="1" 保留秒，避免无关编辑丢失数据。
