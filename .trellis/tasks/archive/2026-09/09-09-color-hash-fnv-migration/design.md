# 技术设计

## 1. 边界与不变量

- **改动面**：`web/src/format.ts`（hash 本体）、`server/src/db.ts`（迁移 + hash 工具）、`server/src/routes/auth.ts`（默认分类落色）、两侧测试、spec 文档、注释。
- **不变量**：
  - API 契约不变：`POST/PUT /api/categories|tags` 的 `color` 仍可空、zod 1–8 校验不变。
  - 色板 token（`--category-1..8`）不变，只换「名称 → 索引」的映射函数。
  - `categoryIndex(name)` 返回 0–7 的签名与语义不变（+1 后落库）。
  - 同名确定性：纯函数，无随机。

## 2. 新 hash：FNV-1a 32-bit

```ts
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function categoryIndex(name: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h % 8;
}
```

- 选 FNV-1a 的理由：实现极简（6 行）、雪崩性质远好于 31 进制 hash、前端后端（TS 同构）零成本复用、无外部依赖。
- `charCodeAt` 按代码单元迭代（与旧实现一致），BMP 外字符（emoji 等）按代理对两单元参与 hash——行为确定即可，不追求语义分解。
- `Math.imul` 保证 32 位乘法语义（普通 `*` 会丢位产生浮点精度问题）。

## 3. 服务端固化迁移（`server/src/db.ts`）

### 3.1 hash 工具放置

新文件 `server/src/color-hash.ts`：导出 `categoryIndex(name: string): number`（FNV-1a 实现 + `+1` 不做，保持 0–7 语义与前端对齐）。文件头注释指向前端 `web/src/format.ts`，前端注释反向指向此文件——两处实现必须逐字一致（无共享包机制，单仓库下双实现 + 测试锚定）。

### 3.2 migrate() 追加

在 `migrate(sqlite)` 末尾（tags 列迁移之后）追加：

```ts
// 一次性固化：color 为 NULL 的分类/标签按新 FNV-1a hash 回填 1–8
for (const table of ["categories", "tags"] as const) {
  const rows = sqlite
    .prepare(`SELECT id, name FROM ${table} WHERE color IS NULL`)
    .all() as { id: string; name: string }[];
  if (rows.length === 0) continue;
  const update = sqlite.prepare(`UPDATE ${table} SET color = ? WHERE id = ?`);
  const fix = sqlite.transaction(() => {
    for (const row of rows) update.run(categoryIndex(row.name) + 1, row.id);
  });
  fix();
}
```

- **幂等性**：只 SELECT `color IS NULL` 行；固化后条件不再命中，重复 `openDb` 无副作用。无 schema 变更、无版本标记需求。
- **性能**：个人应用数据量（数百行级）单事务瞬时完成；不做分批。
- **选新 hash 固化的决策**：若按旧 hash 固化，旧偏差被永久写入数据，用户的原始诉求（中文配色不均）无法解决；且 NULL 行原本就没有「用户已确认的颜色」，一次性变色是可接受成本，UI 仍可手改。

### 3.3 注册默认分类

`server/src/routes/auth.ts` 创建 `DEFAULT_CATEGORIES` 时补 `color: categoryIndex(name) + 1`，消除 NULL 新增来源。

## 4. 前端改动

- `format.ts`：替换 `categoryIndex` 函数体；更新两处「hash 逻辑不可改动」注释为新契约描述（颜色已固化，hash 仅防御性回退）。
- `NameColorEditPopover.tsx`：仅更新 `initialColor` 的注释（逻辑不变——NULL 回退 hash 色，迁移后该分支实际只剩防御意义）。
- `format.test.ts`：hash 相关用例改用已知向量锚定（如 `categoryIndex("读书") === 期望值`，期望值由实现一次性计算后写死进测试），保留确定性/范围/前后景一致用例。

## 5. 测试设计

### 前端（`web/src/format.test.ts`）

- 已知向量：4–6 个中英文名称 → 写死的索引值（锚定实现防漂移）。
- 确定性：同名两次调用一致（保留现有用例）。
- 范围：结果恒在 0–7（保留 `paletteColor` 正则用例，已覆盖）。

### 服务端（新建 `server/test/color-hash.test.ts` + 迁移测试）

- hash 与前端一致性：内联同一组已知向量（与前端测试同一批名称、同一批期望值，双份锚定）。
- 迁移固化：内存 SQLite 建库 → 插入 color NULL / 已设色行 → `openDb` → 断言 NULL 行变为 1–8、已设色行不变；再次 `openDb`（幂等）值不再变化。
- 注册默认分类：走现有 auth 注册测试路径（若已有）或直接验证 DEFAULT_CATEGORIES 映射非 NULL（`categoryIndex(name)+1` 恒为 1–8，单元断言即可）。

## 6. 兼容与回滚

- 升级路径：部署新版本 → 首次启动 `openDb` 完成固化，无停机窗口（WAL + 单事务，毫秒级）。
- 视觉影响：仅 color=NULL 的行一次性变到新 hash 色；已显式设色行零影响。
- 回滚：git revert 代码即可；已固化的 color 值不回滚也无害（显式色本身合法）。不设计「固化值清回 NULL」的逆向迁移——无实际场景需要。
