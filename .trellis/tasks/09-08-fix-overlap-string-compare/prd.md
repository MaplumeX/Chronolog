# Fix time-overlap check string comparison defect

## 背景

`POST /api/entries` / `PATCH /api/entries/:id` 的时间校验（`checkTimeOrder` / `checkOverlap`）以及查询侧的 overlap 窗口比较，均基于 ISO 字符串的字典序比较（SQL TEXT 列上 `lt`/`gt`）。

`z.iso.datetime()` 只校验格式、不规范化输出，同时接受 `2026-01-01T12:00:00Z`（无毫秒）与 `2026-01-01T12:00:00.000Z`（有毫秒），原样入库。两种格式的字典序大小与真实时刻大小不一致（`Z` vs `.000Z`、`.5Z` vs `Z`、`.12Z` vs `.125Z` 等）。

自家前端与服务端恒用 `toISOString()`（`.000Z` 格式）所以未暴露；但项目支持 API token，外部客户端可提交无毫秒格式，混格式数据入库后会出现误判。实测已验证三种错误（见下）。

## 问题清单（实测复现）

设存量条目 `startedAt='...T12:00:00Z'`（无毫秒），新条目用 `.000Z` 格式：

1. **误报重叠**：边界相接（存量 end == 新 start）时 `gt(existingEnd, newStart)` 为 true → 半开区间语义被破坏，本应放行却返回 409 `OVERLAP`。
2. **误报顺序错误**：`stoppedAt='...00.5Z'` 与 `startedAt='...00Z'` 时刻上晚 0.5s，`checkTimeOrder` 的 `<=` 却判 true → 错误 400。
3. **漏检真实重叠**：`lt(existingStart, newStopped)` 用无毫秒/毫秒混比时可能为 false → 本应 409 却放行。

## 修复方案

在 zod 解析边界统一规范化时间字符串：`z.iso.datetime().transform(v => new Date(v).toISOString())`，保证所有入库时间恒为 `.000Z` 毫秒格式，使字典序比较与时刻比较一致。

涉及 schema 边界（`server/src/routes/entries.ts` 的 `updateBody.startedAt` / `stoppedAt`，及 `boundaryQuery.start` / `end` 的一致性确认）。查询侧（`entries.ts` / `goals.ts` 的 overlap、`listBoundary`）与写入侧格式统一后无需改动（服务端自身生成的时间已是 `toISOString()` 格式）。

## 验收标准

- [ ] `POST /api/entries` / `PATCH /api/entries/:id` 接受无毫秒 ISO（`...T12:00:00Z`）与毫秒 ISO（含 `.5Z`、`.125Z`），入库后返回值恒为 `.000Z` 格式（`toISOString` 规范化）。
- [ ] 混格式回归用例：
  - 存量条目以无毫秒格式创建，新条目边界相接（`.000Z`）→ 不 409，正常创建/编辑；
  - `stoppedAt` 为 `...00.5Z`、`startedAt` 为 `...00Z`（同时规范化后仍晚于）→ 不误报 400；
  - 真实重叠场景（存量 `...00Z` 结束晚于新条目开始）→ 仍正确 409 `OVERLAP`。
- [ ] 既有测试全部通过（`npm test`），既有边界相接（touching edges）用例不受影响。
- [ ] `/api/entries/boundary` 的 `start`/`end` query 参数若同样存在混格式风险，一并处理或确认无影响。

## 非目标

- 不改动 overlap 半开区间语义（边界相接不算重叠、运行中条目视为 ∞）。
- 不迁移存量数据（现网数据均为 `toISOString()` 格式，无需迁移）。
- 不涉及前端改动（前端恒用 `toISOString()`）。
