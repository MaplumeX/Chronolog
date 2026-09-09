import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, it } from "node:test";
import { buildApp } from "../src/app.js";
import { categoryIndex } from "../src/color-hash.js";
import { registerUser } from "./helpers.js";

/**
 * 名称 → 期望索引的已知向量。与前端 web/src/format.test.ts 用同一批名称与期望值
 * 锚定双实现一致性（server/src/color-hash.ts ↔ web/src/format.ts）。
 */
const KNOWN_VECTORS: [string, number][] = [
  ["读书", 4],
  ["工作", 4],
  ["学习", 3],
  ["休息", 1],
  ["事务", 1],
  ["English", 3],
  ["a", 4],
];

describe("categoryIndex (FNV-1a)", () => {
  it("已知向量锚定：与前端同一批名称/期望值", () => {
    for (const [name, expected] of KNOWN_VECTORS) {
      assert.equal(categoryIndex(name), expected, `${name} 应为 ${expected}`);
    }
  });

  it("确定性：同名两次调用一致", () => {
    for (const [name] of KNOWN_VECTORS) {
      assert.equal(categoryIndex(name), categoryIndex(name));
    }
  });

  it("结果恒在 0–7；DEFAULT_CATEGORIES 落库色为 1–8 非 NULL", () => {
    for (const name of ["工作", "学习", "休息", "事务", "读书", "x", ""]) {
      const idx = categoryIndex(name);
      assert.ok(idx >= 0 && idx <= 7 && Number.isInteger(idx));
      const color = idx + 1;
      assert.ok(color >= 1 && color <= 8, "落库色应为 1–8");
    }
  });
});

/**
 * 存量 NULL 固化迁移（task 09-09）：color IS NULL 的 categories/tags 行按新 hash 回填 1–8，
 * 已显式设色行不变；重复 openDb 幂等（值不再变化）。
 */
describe("color NULL backfill migration", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("backfills NULL colors with FNV hash, keeps explicit colors, is idempotent", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "chronolog-color-mig-"));
    const dbPath = path.join(dir, "legacy.db");

    // 1) 先用当前代码建库并注册一个用户（拿到带默认数据的库），再手动把若干行 color 置 NULL
    let app = await buildApp({
      dbPath,
      cookieSecure: false,
      sessionTtlSeconds: 604800,
      registrationOpen: true,
      logger: false,
    });
    try {
      await registerUser(app, "color_migration_user");
    } finally {
      await app.close();
    }

    // categories / tags 各造一行：置 NULL 一行（注册默认分类本身带色，挑一行清掉）、再显式设一行
    {
      const w = new Database(dbPath);
      const catIds = w.prepare("SELECT id, name FROM categories ORDER BY created_at").all() as {
        id: string;
        name: string;
      }[];
      assert.ok(catIds.length > 0, "注册应 seed 默认分类");
      // 全部默认分类先断言非 NULL（新代码注册即落色）
      for (const c of catIds) {
        const row = w.prepare("SELECT color FROM categories WHERE id = ?").get(c.id) as {
          color: number | null;
        };
        assert.ok(row.color != null, `默认分类 ${c.name} 的 color 应非 NULL`);
      }
      // 挑一行置 NULL（模拟存量 NULL 数据），其余保留
      w.prepare("UPDATE categories SET color = NULL WHERE id = ?").run(catIds[0].id);
      // tags 表插入一行 NULL、一行显式色
      const userId = (w.prepare("SELECT id FROM users WHERE username = ?").get(
        "color_migration_user",
      ) as { id: string }).id;
      w.prepare(
        `INSERT INTO tags (id, user_id, name, color, parent_id, created_at)
         VALUES ('t-null', ?, '读书', NULL, NULL, '2026-09-01T00:00:00.000Z')`,
      ).run(userId);
      w.prepare(
        `INSERT INTO tags (id, user_id, name, color, parent_id, created_at)
         VALUES ('t-set', ?, '工作', 2, NULL, '2026-09-01T00:00:00.000Z')`,
      ).run(userId);
      w.close();
    }

    // 2) 重新打开：迁移应固化 NULL 行
    const app2 = await buildApp({
      dbPath,
      cookieSecure: false,
      sessionTtlSeconds: 604800,
      registrationOpen: true,
      logger: false,
    });
    try {
      const r = new Database(dbPath, { readonly: true });
      try {
        // 不存在 NULL 行
        const nullCats = r.prepare("SELECT count(*) n FROM categories WHERE color IS NULL").get() as {
          n: number;
        };
        assert.equal(nullCats.n, 0, "categories 不应有 color IS NULL 行");
        const nullTags = r.prepare("SELECT count(*) n FROM tags WHERE color IS NULL").get() as {
          n: number;
        };
        assert.equal(nullTags.n, 0, "tags 不应有 color IS NULL 行");

        // 固化值 = 新 hash + 1
        const backfilledTag = r.prepare("SELECT color FROM tags WHERE id = 't-null'").get() as {
          color: number;
        };
        assert.equal(backfilledTag.color, categoryIndex("读书") + 1);

        // 已显式设色行不变
        const setTag = r.prepare("SELECT color FROM tags WHERE id = 't-set'").get() as {
          color: number;
        };
        assert.equal(setTag.color, 2);
      } finally {
        r.close();
      }
    } finally {
      await app2.close();
    }

    // 3) 三次打开（幂等）：固化后的值不再变化
    const app3 = await buildApp({
      dbPath,
      cookieSecure: false,
      sessionTtlSeconds: 604800,
      registrationOpen: true,
      logger: false,
    });
    try {
      const r = new Database(dbPath, { readonly: true });
      try {
        const backfilled = r.prepare("SELECT color FROM tags WHERE id = 't-null'").get() as {
          color: number;
        };
        assert.equal(backfilled.color, categoryIndex("读书") + 1);
        const setTag = r.prepare("SELECT color FROM tags WHERE id = 't-set'").get() as {
          color: number;
        };
        assert.equal(setTag.color, 2);
        const nullTags = r.prepare("SELECT count(*) n FROM tags WHERE color IS NULL").get() as {
          n: number;
        };
        assert.equal(nullTags.n, 0);
      } finally {
        r.close();
      }
    } finally {
      await app3.close();
    }
  });
});
