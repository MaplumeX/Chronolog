import assert from "node:assert/strict";
import fs from "node:fs";
import { afterEach, describe, it } from "node:test";
import { buildApp } from "../src/app.js";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

async function firstCategory(app: TestApp["app"], sid: string) {
  const res = await app.inject({
    method: "GET",
    url: "/api/categories",
    headers: cookieHeader(sid),
  });
  const cats = json(res).categories as { id: string; name: string }[];
  return cats;
}

describe("timer", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("start without category is 400; stop with none is 409", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "timer_user");
    const noCat = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { description: "x" },
    });
    assert.equal(noCat.statusCode, 400);

    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 409);
  });

  it("stop-then-start leaves only one running entry", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "switcher");
    const cats = await firstCategory(t.app, sid);

    const first = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id, description: "one" },
    });
    assert.equal(first.statusCode, 200);
    const firstId = (json(first).entry as { id: string }).id;
    const firstStarted = (json(first).entry as { startedAt: string }).startedAt;

    const second = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[1].id, description: "two" },
    });
    assert.equal(second.statusCode, 200);
    const secondEntry = json(second).entry as { id: string; stoppedAt: string | null };
    assert.notEqual(secondEntry.id, firstId);
    assert.equal(secondEntry.stoppedAt, null);

    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    const running = json(current).entry as { id: string };
    assert.equal(running.id, secondEntry.id);

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { id: string; stoppedAt: string | null }[];
    const runningCount = entries.filter((e) => e.stoppedAt === null).length;
    assert.equal(runningCount, 1);
    const stopped = entries.find((e) => e.id === firstId);
    assert.ok(stopped?.stoppedAt);
    assert.equal(stopped?.stoppedAt && stopped.stoppedAt >= firstStarted, true);
  });

  it("start with tagIds attaches tags; current returns them", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tagged");
    const cats = await firstCategory(t.app, sid);

    const tagA = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "深度" },
    });
    const tagB = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "专注" },
    });
    const tagAId = json(tagA).id as string;
    const tagBId = json(tagB).id as string;

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id, tagIds: [tagAId, tagBId, tagAId] },
    });
    assert.equal(start.statusCode, 200);
    const entry = json(start).entry as { id: string; tags: { id: string; name: string }[] };
    assert.equal(entry.tags.length, 2);
    assert.deepEqual(
      entry.tags.map((x) => x.id).sort(),
      [tagAId, tagBId].sort(),
    );

    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    const running = json(current).entry as { tags: { id: string; name: string }[] };
    assert.equal(running.tags.length, 2);
  });

  it("start with a foreign tag id is 404", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_foreign");
    const cats = await firstCategory(t.app, sid);
    const res = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id, tagIds: ["no-such-tag"] },
    });
    assert.equal(res.statusCode, 404);
  });

  it("update running entry: description trim + categoryId + tagIds", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "upd_running");
    const cats = await firstCategory(t.app, sid);

    const tagA = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "标签甲" },
    });
    const tagB = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "标签乙" },
    });
    const tagAId = json(tagA).id as string;
    const tagBId = json(tagB).id as string;

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id, description: "old", tagIds: [tagAId] },
    });

    const upd = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: {
        description: "  new desc  ",
        categoryId: cats[1].id,
        tagIds: [tagBId, tagAId, tagBId],
      },
    });
    assert.equal(upd.statusCode, 200);
    const entry = json(upd).entry as {
      description: string;
      categoryId: string;
      startedAt: string;
      stoppedAt: string | null;
      tags: { id: string }[];
    };
    assert.equal(entry.description, "new desc");
    assert.equal(entry.categoryId, cats[1].id);
    assert.equal(entry.stoppedAt, null);
    assert.deepEqual(
      entry.tags.map((x) => x.id).sort(),
      [tagAId, tagBId].sort(),
    );

    // 时间字段未被修改
    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    const running = json(current).entry as { stoppedAt: string | null; tags: { id: string }[] };
    assert.equal(running.stoppedAt, null);
    assert.equal(running.tags.length, 2);
  });

  it("update running entry error paths", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "upd_err");
    const cats = await firstCategory(t.app, sid);

    // 无运行计时 → 409
    const noRunning = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { description: "x" },
    });
    assert.equal(noRunning.statusCode, 409);
    assert.equal((json(noRunning).error as { code: string }).code, "CONFLICT");

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });

    // description > 200 → 400
    const tooLong = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { description: "a".repeat(201) },
    });
    assert.equal(tooLong.statusCode, 400);
    assert.equal((json(tooLong).error as { code: string }).code, "VALIDATION");

    // 他人 categoryId → 404
    const other = await registerUser(t.app, "upd_other");
    const otherCats = await firstCategory(t.app, other.sid);
    const foreignCat = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { categoryId: otherCats[0].id },
    });
    assert.equal(foreignCat.statusCode, 404);

    // 他人 tagIds → 404
    const foreignTag = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { tagIds: ["no-such-tag"] },
    });
    assert.equal(foreignTag.statusCode, 404);

    // startedAt 字段被 schema 拒绝 → 400
    const withStart = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { startedAt: "2025-01-01T00:00:00Z" },
    });
    assert.equal(withStart.statusCode, 400);
    assert.equal((json(withStart).error as { code: string }).code, "VALIDATION");

    // 未登录 → 401
    const anon = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      payload: { description: "x" },
    });
    assert.equal(anon.statusCode, 401);
  });

  it("reopening the database keeps a running timer", async () => {
    t = await createTestApp({ keepDir: true });
    const { sid } = await registerUser(t.app, "persist");
    const cats = await firstCategory(t.app, sid);
    const started = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });
    const startedAt = (json(started).entry as { startedAt: string }).startedAt;
    const dbPath = t.dbPath;
    const dir = t.dir;
    await t.app.close();

    const app2 = await buildApp({
      dbPath,
      cookieSecure: false,
      sessionTtlSeconds: 604800,
      registrationOpen: true,
      logger: false,
    });
    try {
      const current = await app2.inject({
        method: "GET",
        url: "/api/timer/current",
        headers: cookieHeader(sid),
      });
      assert.equal(current.statusCode, 200);
      const entry = json(current).entry as { startedAt: string; stoppedAt: string | null };
      assert.equal(entry.startedAt, startedAt);
      assert.equal(entry.stoppedAt, null);
    } finally {
      await app2.close();
      fs.rmSync(dir, { recursive: true, force: true });
      t = undefined as unknown as TestApp;
    }
  });
});
