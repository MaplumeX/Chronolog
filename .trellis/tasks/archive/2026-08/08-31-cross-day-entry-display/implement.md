# Implement Plan — cross-day-entry-display

轻量前端修复。改动集中在 `web/src/components/Timeline.tsx`（几何 + 文案 + tooltip）与 `web/src/format.ts`（新增纯函数）+ 两个 locale 文件。

## 执行清单（按序）

- [ ] 1. `web/src/format.ts` 新增两个纯函数：
  - `clipRangeMs(startedAt, stoppedAt, dayStartMs, dayEndMs, nowMs): { startMs, endMs }` — 把条目起止夹到 `[dayStartMs, dayEndMs)`；`stoppedAt=null` 用 `nowMs`。
  - `formatEntryTimeRange(startedAt, stoppedAt, columnDayStartMs, tz, nowMs): string` — 生成块上/tooltip 的时间范围文案，按 PRD R3 规则加日属前缀：端点与该列同一天 → `HH:MM`（复用 `formatClock`）；±1 天 → `t("timeline.dayRel.prev"/"next") + " " + HH:MM`；跨更多天 → `t("timeline.dayAbs", {date: MM-DD}) + " " + HH:MM` 或等价 i18n 插值。`stoppedAt=null` 右端沿用 `…`（其日属按 nowMs 与该列关系判断，通常同天不加前缀）。
- [ ] 2. `web/src/i18n/locales/zh.ts` / `en.ts` 同步新增 key（zh/en 必须一一对应，`en` 类型是 `Record<keyof typeof zh, string>`）：
  - `timeline.dayRel.prev`：zh `昨天` / en `Yesterday`
  - `timeline.dayRel.next`：zh `明天` / en `Tomorrow`
  - `timeline.dayAbs`（日期回退，如 `{{date}}`）：zh `{{date}}` / en `{{date}}`（date 由 `MM-DD` 格式化）
- [ ] 3. `web/src/components/Timeline.tsx` `DayColumn` 条目块渲染：
  - 用 `clipRangeMs` 的结果替换原来的 `const start = Date.parse(e.startedAt); const end = ...`，再算 `top` / `heightPct`（R1）。
  - 块上时长 `formatDuration(secs)` 的 `secs` 由 `clipSeconds(...)` 改为 `e.durationSeconds`（R2）；tooltip `title` 里的时长同步（R4）。
  - `timeRange` 改用 `formatEntryTimeRange(...)`，块上 `block-time` 与 tooltip 共用（R3/R4）。
  - **不动**：列头 `dayTotal` / `totalClippedSeconds`（仍按切片，R5）；gap 插槽、拖拽创建、EntryEditor。
- [ ] 4. 校验：`npm run typecheck`、`npm run build -w web`、`npm test -w server` 全绿。
- [ ] 5. 手动验证（见下）。

## 验证命令

```bash
npm run typecheck            # 含 web + server
npm run build -w web
npm test -w server           # 后端不回归
```

## 手动验证（spec 约定，UI 行为靠运行 app）

`npm run dev` 后构造跨天条目（可用 EntryEditor 把某条目改成 昨天 23:00 → 今天 01:00）：
1. **今天列**：色块 00:00–01:00（不再画到 02:00）；时长 `2:00:00`；范围 `昨天 23:00 – 01:00`。
2. **昨天列**（DateNav 切到昨天 / week 视图昨天列）：色块 23:00–24:00；时长 `2:00:00`；范围 `23:00 – 明天 01:00`。
3. **非跨天条目**：几何与文案与改动前一致（无日属前缀）。
4. **列头合计**：今天列头合计只含该条目 1h 切片（不变成 2h）。
5. zh / en 切换：日属标记与日期格式正确。
6. 运行中跨天条目：右端 `…`，时长随 now 增长。

## 回滚点

单一代码改动集，直接 `git checkout -- web/src/components/Timeline.tsx web/src/format.ts web/src/i18n/locales/` 即可回退；无 schema / API 变更。

## 边界与注意

- `formatClock` 已按 tz 格式化，日属判断用「端点所在日历日」与「该列日历日」的天数差（在 tz 下比较，勿用 UTC 日期相减）。可借助 `Intl.DateTimeFormat("en-CA", { timeZone: tz })` 取端点与列日的 `YYYY-MM-DD` 再比较，与项目既有「纯日历标签」手法一致。
- 运行中条目右端用 `nowMs`，与现有 `clipSeconds` / 几何右端保持一致。
- 色块半透明底色 / tier 阈值 / 颜色逻辑不得改动。
