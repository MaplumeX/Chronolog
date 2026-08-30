import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, it } from "node:test";
import { buildApp } from "../src/app.js";
import { cookieHeader, json, sidOf, type TestApp } from "./helpers.js";

/**
 * 老库迁移回归：模拟「层级支持之前的库结构」（无 parent_id 列、带 (user_id, name) 唯一索引），
 * 用新代码启动后应自动加列、删旧唯一索引，且既有数据全部保持为顶层节点、功能不变。
 */
describe("hierarchy migration", () => {
  let t: TestApp | undefined;
  let dir: string | undefined;
  afterEach(async () => {
    await t?.close();
    t = undefined;
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("upgrades a legacy db: adds parent_id, drops (user_id, name) unique indexes, keeps data as top-level", async () => {
    // 1) 手工建一个「老结构」的库（categories/tags 无 parent_id，有旧唯一索引）并写入数据
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "chronolog-mig-"));
    const dbPath = path.join(dir, "legacy.db");
    const legacy = new Database(dbPath);
    legacy.pragma("journal_mode = WAL");
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX users_username_unique ON users(username);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX categories_user_id_name ON categories(user_id, name);
      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX tags_user_id_name ON tags(user_id, name);
      CREATE TABLE time_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id),
        description TEXT NOT NULL DEFAULT '',
        started_at TEXT NOT NULL,
        stopped_at TEXT
      );
      CREATE TABLE entry_tags (
        entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (entry_id, tag_id)
      );
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🎯',
        category_id TEXT REFERENCES categories(id),
        tag_id TEXT REFERENCES tags(id),
        direction TEXT NOT NULL,
        hours REAL NOT NULL,
        period_unit TEXT NOT NULL,
        due_date TEXT,
        created_at TEXT NOT NULL
      );
    `);
    legacy.prepare(
      `INSERT INTO users (id, username, password_hash, display_name, created_at)
       VALUES ('u1', 'legacy_user', 'x', NULL, '2026-08-01T00:00:00.000Z')`,
    ).run();
    legacy.prepare(
      `INSERT INTO categories (id, user_id, name, color, created_at)
       VALUES ('c1', 'u1', '旧分类', 2, '2026-08-01T00:00:00.000Z')`,
    ).run();
    legacy.prepare(
      `INSERT INTO tags (id, user_id, name, color, created_at)
       VALUES ('t1', 'u1', '旧标签', NULL, '2026-08-01T00:00:00.000Z')`,
    ).run();
    legacy.close();

    // 2) 用新代码打开（buildApp → openDb → migrate）
    const app = await buildApp({
      dbPath,
      cookieSecure: false,
      sessionTtlSeconds: 604800,
      registrationOpen: true,
      logger: false,
    });
    try {
      // 3) 结构断言：parent_id 列存在，旧唯一索引已删除，新普通索引存在
      const sqlite = new Database(dbPath, { readonly: true });
      try {
        const catCols = (sqlite.pragma("table_info(categories)") as { name: string }[]).map(
          (c) => c.name,
        );
        assert.ok(catCols.includes("parent_id"), "categories 应有 parent_id 列");
        const tagCols = (sqlite.pragma("table_info(tags)") as { name: string }[]).map(
          (c) => c.name,
        );
        assert.ok(tagCols.includes("parent_id"), "tags 应有 parent_id 列");

        const catIdx = (sqlite.pragma("index_list(categories)") as { name: string }[]).map(
          (i) => i.name,
        );
        assert.ok(!catIdx.includes("categories_user_id_name"), "旧唯一索引应被删除");
        assert.ok(catIdx.includes("categories_user_parent"), "新 (user_id, parent_id) 索引应存在");
        const tagIdx = (sqlite.pragma("index_list(tags)") as { name: string }[]).map(
          (i) => i.name,
        );
        assert.ok(!tagIdx.includes("tags_user_id_name"), "旧唯一索引应被删除");
        assert.ok(tagIdx.includes("tags_user_parent"), "新 (user_id, parent_id) 索引应存在");
      } finally {
        sqlite.close();
      }

      // 4) 数据断言：老用户登录（password_hash 是假的，直接造 session）后旧分类/标签均为顶层
      const sid = "migratetestsession000000000000";
      {
        const w = new Database(dbPath);
        w.prepare(
          `INSERT INTO sessions (id, user_id, expires_at, created_at)
           VALUES (?, 'u1', '2999-01-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
        ).run(sid);
        w.close();
      }

      const catsRes = await app.inject({
        method: "GET",
        url: "/api/categories",
        headers: cookieHeader(sid),
      });
      assert.equal(catsRes.statusCode, 200);
      const cats = json(catsRes).categories as { id: string; name: string; parentId: string | null }[];
      const old = cats.find((c) => c.name === "旧分类");
      assert.ok(old);
      assert.equal(old.parentId, null);

      const tagsRes = await app.inject({
        method: "GET",
        url: "/api/tags",
        headers: cookieHeader(sid),
      });
      assert.equal(tagsRes.statusCode, 200);
      const tags = json(tagsRes).tags as { id: string; name: string; parentId: string | null }[];
      const oldTag = tags.find((x) => x.name === "旧标签");
      assert.ok(oldTag);
      assert.equal(oldTag.parentId, null);

      // 5) 升级后可用：在旧分类下建子分类（跨父重名——旧唯一索引已删，不再拦截）
      const child = await app.inject({
        method: "POST",
        url: "/api/categories",
        headers: cookieHeader(sid),
        payload: { name: "旧分类", parentId: old.id },
      });
      assert.equal(child.statusCode, 200);
      assert.equal(json(child).parentId, old.id);

      // 新建顶层分类正常（同父范围内不重名）
      const dupTop = await app.inject({
        method: "POST",
        url: "/api/categories",
        headers: cookieHeader(sid),
        payload: { name: "新顶层" },
      });
      assert.equal(dupTop.statusCode, 200);

      // 新注册用户 seed 正常
      const reg = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "after_migration", password: "password1" },
      });
      assert.equal(reg.statusCode, 200);
      const newSid = sidOf(reg);
      const newCats = await app.inject({
        method: "GET",
        url: "/api/categories",
        headers: cookieHeader(newSid),
      });
      const seeded = json(newCats).categories as { name: string; parentId: string | null }[];
      assert.equal(seeded.filter((c) => c.parentId === null).length, 4);
    } finally {
      await app.close();
    }
  });
});
