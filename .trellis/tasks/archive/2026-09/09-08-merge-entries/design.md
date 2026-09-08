# Design：相邻条目合并

## 1. 总体方案

单一合并端点 + 前端确认对话框。合并语义在服务端事务内重判（相邻性、所有权、运行中状态），前端只负责发现相邻条目并收集用户选择。

## 2. 后端

### 2.1 端点

`POST /api/entries/:id/merge`

请求体（zod）：

```ts
{
  direction: "prev" | "next",       // 相对 :id 条目的合并方向
  keep: "self" | "other"            // 属性保留来源：self = :id 条目，other = 相邻条目
}
```

响应：`{ entry: EntryDto }`（合并后保留条目的完整 DTO，复用 `getEntry`）。

### 2.2 相邻条目查找（服务端权威）

在事务内查：

- `direction === "prev"`：`startedAt < entry.startedAt` 且（stoppedAt 非空）的条目中 `startedAt` 最大的一条。约束 stoppedAt 非空的原因：运行中的条目右端为 ∞，必然覆盖当前条目区间（与既有唯一运行中条目不变量冲突），排除后候选必然是已停止条目。
  - 若该候选的 `stoppedAt > entry.startedAt` → 两条本来就重叠，属于数据异常，回 409。
- `direction === "next"`：`startedAt > entry.startedAt` 中 `startedAt` 最小的一条（可能是运行中的，见 2.3 校验拒绝）。

注意：prev 方向按「startedAt 最大」取，而不是按 stoppedAt 最近的——两条时间序相邻意味着 startedAt 相邻（重叠校验保证区间不交叠，startedAt 排序即全序）。

### 2.3 校验顺序（事务内）

1. `:id` 条目存在且属当前用户 → 否则 404 `NOT_FOUND`（隔离惯例，不泄露存在性）。
2. `:id` 条目已停止 → 否则 409 `CONFLICT`（"运行中的条目不可合并"）。
3. 相邻条目存在 → 否则 409 `CONFLICT`（"没有可合并的相邻条目"）。
4. 相邻条目已停止 → 否则 409 `CONFLICT`（运行中不可合并）。
5. 相邻性重判：两条之间不存在第三条条目（`startedAt` 严格介于两者之间的条目数为 0，且无运行中条目横跨）。不满足 → 409 `CONFLICT`（"条目不相邻"）。
   - 依据既有重叠不变量，任何第三条要么完全在 prev 左侧、要么完全在 next 右侧；只需检查 startedAt 介于开区间内无条目 + 无未停止条目其 startedAt < 较晚条 startedAt（它必然横跨）。
   - 兜底：对合并结果跑 `checkOverlap(排除两条自身)`——防御极端并发下的脏数据（AC5）。

### 2.4 合并执行（同一事务）

```
keepId  = keep === "self"  ? :id : 相邻条目 id
otherId = 另一条
源属性   = keep 条当前属性（不改内容，只改时间）
```

1. `update time_entries set startedAt = min(两条), stoppedAt = max(两条) where id = keepId`
2. `delete entry_tags where entryId = otherId`（显式清理，虽然 CASCADE 也会处理；与既有 update 路由重写 tags 的风格一致）——实际上直接依赖 CASCADE 即可，保持简单：只 `delete from time_entries where id = otherId`。
3. 返回 `getEntry(tx 内 or 事务后, keepId)`。

属性不迁移：keep 条的分类/标签/说明原样保留（方案 A），被删条目的属性随之丢弃。

### 2.5 代码位置

- 路由注册：`server/src/routes/entries.ts` 内 `registerEntryRoutes`，沿用 `requireUser` / `parseBody` / `AppError` / `Deps` 模式。
- 合并核心逻辑放 `server/src/entries.ts` 导出函数（与 `listBoundary` 同层），便于测试与路由瘦化。

## 3. 前端

### 3.1 API client（`web/src/api.ts`）

```ts
mergeEntry(id: string, body: { direction: "prev" | "next"; keep: "self" | "other" }): Promise<TimeEntry>
```

POST `/api/entries/${id}/merge`，沿用 fetch 封装与 ApiError。

### 3.2 相邻条目数据来源

Timeline 已持有当前视图全部条目，但相邻条目可能在视图外（跨天）。方案：**新增后端预览/发现能力合并进 merge 端点做不到（merge 是写操作）**，采用：

- 在 EntryEditor 打开时不需要数据；用户点「与上一条/下一条合并」时，前端先调 `POST /api/entries/:id/merge` 的前置只读端点？——不引入额外端点，改为：**合并对话框打开时由 Timeline 提供相邻候选**：
  - 视图内：从 `today.entries` / `week.days[].entries` 排序取前驱/后继。
  - 视图边界外：复用既有 `GET /api/entries/boundary`（prevEntry/nextEntry）数据（Timeline 已加载，prop `boundary`）。day 模式下即可覆盖跨天场景；week 模式下视图跨 7 天，极外侧同理。
  - 若两侧都拿不到（boundary 未加载失败降级时）→ 对应方向按钮禁用。
- 相邻候选只用于**预览展示与禁用态**；最终相邻性由服务端重判（2.3），过期时报错可读。

### 3.3 UI 流程

`EntryEditor`（编辑模式）底部操作区，与「删除」并排增加两个 ghost 按钮（图标+文案）：「与上一条合并」「与下一条合并」（i18n：`entry.mergePrev` / `entry.mergeNext`）。

点击 → 新组件 `MergeDialog`（复用 `ConfirmDialog` 不合适——需要二选一选择，新建对话框组件，风格对齐）：

- 标题：「合并条目」
- 内容：两张并排/堆叠的条目预览卡（时间范围、时长、分类、标签、说明），各带单选标记；默认选中当前条目（keep = self）。选中的卡高亮。
- 展示合并后的时间范围结果预览（早 start → 晚 stop）。
- 确认 → `api.mergeEntry(...)` → 成功 `onSaved()`（关 popover + 刷新）；失败错误显示在对话框内，可重试/取消。

### 3.4 i18n

`zh.ts` / `en.ts` 新增 `entry.mergePrev`、`entry.mergeNext`、`entry.mergeTitle`、`entry.mergeKeepSelf`、`entry.mergeKeepOther`、`entry.mergeResultRange`、`entry.mergeFailed` 等；同步 `i18next.d.ts`。

## 4. 数据与兼容

- 无 schema 变更、无迁移。
- 合并是纯应用层操作（update + delete），失败事务回滚，无部分状态。
- 回滚方案：功能整体增量，出问题 revert 单个 commit 即可。

## 5. 权衡记录

- **相邻判定放服务端**而非信任前端：防止视图数据过期导致跨第三条合并，语义唯一权威。
- **不引入 preview 端点**：前端用视图数据 + boundary 数据做预览，接受「预览可能过期 → 提交时报错」的边界情况，换取 API 面最小。
- **运行中条目不参与合并**：与既有「运行中不可编辑/删除」不变量保持一致，避免停止计时器与合并的复合状态。
- **属性不迁移、整条二选一**（方案 A）：交互一次点击决定，符合碎片记录同源的直觉。
