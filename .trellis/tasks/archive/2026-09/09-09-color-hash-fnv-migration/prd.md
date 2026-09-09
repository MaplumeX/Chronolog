# 换更好的颜色哈希并固化存量 NULL 颜色

## Goal

替换 `web/src/format.ts` 中对中文分布不均的 31 进制多项式 hash（31 ≡ -1 (mod 8)，退化为码点交错和），改用混合更好的 FNV-1a 32-bit hash；同时服务端启动迁移把 `categories` / `tags` 中 `color IS NULL` 的存量行一次性固化（写入 1–8 色板索引），消除「hash 改动会导致存量 NULL 数据颜色漂移」这一历史约束。

## Background

- 现有算法：`h = h*31 + charCode` 循环后 `% 8`。由于 31 ≡ 7 ≡ -1 (mod 8)，乘法混合被完全抵消，索引退化为码点交错和 `(c₁ − c₂ + c₃ − …) mod 8`，对中文（码点分布不均、双字词差值集中）有系统性偏差。
- 历史约束「hash 逻辑不可改动」（`format.ts` 注释 + `design-tokens.md`）存在的原因正是存量 NULL 数据依赖 hash 回退色。固化 NULL 后该约束解除。

## Requirements

### R1 — 前端换 FNV-1a hash

- `categoryIndex(name)` 改为 FNV-1a 32-bit（offset basis 0x811c9dc5，prime 0x01000193，`Math.imul` 乘法），对 8 取模。
- 所有调用点（`paletteColor` 回退、`paletteForegroundColor` 回退、`CategoriesPage`/`TagsPage` 创建、`NameColorEditPopover.initialColor`）签名不变，无需改动。
- 同名同色的确定性保持不变。

### R2 — 服务端存量 NULL 数据一次性固化

- `server/src/db.ts` 的 `migrate()` 中新增幂等回填：对 `categories` 和 `tags` 中 `color IS NULL` 的行，用与服务端一致的 FNV-1a hash 计算 `name → 1–8` 并 UPDATE。
- 固化值用**新 hash** 计算（理由：用户诉求正是中文配色不均，若固化旧 hash 值会把旧偏差永久锁进数据；固化后用户仍可在 UI 手动改色）。
- 服务端需实现与前端完全一致的 hash 函数（TS 同构，独立实现于 server 侧，注释互相指向），迁移与注册默认分类共用。
- 注册时创建的 `DEFAULT_CATEGORIES`（工作/学习/休息/事务）直接落库新 hash 色，不再留 NULL。

### R3 — hash 逻辑约束解除

- 移除 `format.ts` 中「hash 逻辑不可改动」注释，改为说明新契约：颜色已固化落库，hash 仅作为 NULL 防御性回退。
- `NameColorEditPopover.initialColor` 的注释同步更新。

## 约束

- 不改 API 契约（`color` 字段仍可空，zod 校验不变）——固化为数据迁移行为，不收紧 API。
- 迁移必须幂等、可重复启动（只动 NULL 行）。
- 不改色板本身（`--category-1..8` token 不动）。

## Acceptance Criteria

- [ ] `web/src/format.ts` 的 `categoryIndex` 使用 FNV-1a；`web/src/format.test.ts` 更新并全绿（确定性、索引 0–7、前后景索引一致用例保持；新增已知向量锚定用例）。
- [ ] 服务端 `migrate()` 后，`categories` / `tags` 中不存在 `color IS NULL` 的行；重复调用 `openDb` 不改已固化的值（幂等验证）。
- [ ] 服务端 hash 与前端 `categoryIndex` 对同一批名称输出一致（服务端测试内联对照一组名称的期望索引）。
- [ ] 注册新用户后默认分类的 `color` 为 1–8 非 NULL。
- [ ] `cd web && npm test` 与 `cd server && npm test` 全绿。
- [ ] spec（`design-tokens.md`）更新：移除「hash 逻辑不可改动」表述，记录新契约与迁移行为。

## Notes

- 视觉影响说明：存量 NULL 分类/标签的颜色会在升级后变为新 hash 色（一次性漂移，正是本任务目的）；已有显式色（1–8 落库）的行不受影响。
