# Implement: Timeline gap placeholder slots

前置阅读：`prd.md`（验收标准）、`design.md`（接口契约与 gap 算法）。
Spec：`.trellis/spec/backend/http-routes.md`、`.trellis/spec/backend/time-and-timezone.md`、`.trellis/spec/frontend/{api-client,component-guidelines,design-tokens}.md`。

## Step 1 — 后端 boundary 查询与路由

- [ ] `server/src/entries.ts`：新增 `listBoundary(db, userId, startIso, endIso)` → `{ prevEntry, nextEntry }`（design §3 查询语义；复用 `entrySelect` / `attachTags`；`prevEntry` 按 `coalesce(stoppedAt, ∞)` 语义取右端最大——running 条目用 `isNull` 优先判定）。
- [ ] `server/src/routes/entries.ts`：`GET /api/entries/boundary?tz=&start=&end=`，zod 校验（`z.iso.datetime()`、`start < end` 否则 400 `VALIDATION`），`requireUser`。
- [ ] `server/test/entries.test.ts`（或新文件 `boundary.test.ts`）：design §7 的后端用例。

验证：`npm test -w server`（在 worktree 根目录跑 `npm test`）。

## Step 2 — 前端 API client

- [ ] `web/src/api.ts`：`BoundaryEntries` 类型 + `api.boundaryEntries(tz, start, end)`。
- [ ] `.trellis/spec/frontend/api-client.md` 若列有方法清单则同步（放到 Phase 3.3 spec update 统一做，此处只改代码）。

验证：`npm run typecheck -w web`。

## Step 3 — 数据接线（use-timer-controller）

- [ ] `boundary` state + 在 `refresh()` / `onDateChange()` / `onModeChange()` / `onToggle()` / `refreshEntries()` 中并行拉取（窗口按当前视图：day → today.dayStart/dayEnd；week → week.weekStart/weekEnd——注意 onModeChange 中先拿到新视图数据再取其窗口）；失败静默降级为 null。
- [ ] `timelineProps` 下发 `boundary`。

验证：typecheck + 手动跑 dev 看 network 请求。

## Step 4 — Gap 计算 + DayColumn 渲染

- [ ] `Timeline.tsx`：`computeGaps` 纯函数（design §4 规则 1–5，输出全局绝对时刻 gap）；按列调用。
- [ ] `DayColumn`：`gaps` / `onGapClick` props；渲染 `.timeline-slot`（top/height 百分比同 block 算法；`< MIN_SLOT_PX`（校准 8–12px）不渲染；`title` 提示）。
- [ ] `web/src/styles.css`：`.timeline-slot` 样式——虚线边框 + 灰色半透明内部，token 化颜色，双主题都要看效果。
- [ ] 拖拽创建 `onPointerDown` 增加 `closest(".timeline-slot")` 早退。

验证：typecheck；dev 手动核对 AC1/AC5。

## Step 5 — 点击创建链路

- [ ] slot 点击 → `Timeline` 设 draft `{ dayStart: 该列 dayStart, startedAt: gap.startMs ISO, stoppedAt: gap.endMs ISO }` → 复用既有 draft popover / EntryEditor；anchor 用被点 slot（`PopoverAnchor` 钉 slot 中心）。
- [ ] 保存 / 取消 / popover 关闭走既有 `clearDraft` 链路，保存后 `onEntryUpdated()` 刷新（AC6）。

验证：手动核对 AC2/AC3/AC4/AC6/AC7。

## Step 6 — 收尾

- [ ] `npm run typecheck -w web` + `npm test`（全绿）。
- [ ] 手动验收清单 AC1–AC7 逐条过一遍（含 light/dark 两主题、60/5 两档 scale）。
- [ ] Phase 3.3 spec update：`http-routes.md` 增 boundary 行；`component-guidelines.md` Timeline 段补 slot 描述。
- [ ] Phase 3.4 commit。

## 回滚点

- 每个 Step 一个 commit 粒度（或最终单 commit），无 schema 变更，revert 即回滚。
