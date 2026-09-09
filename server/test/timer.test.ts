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

describe("timer + archived categories (task 08-31)", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  async function firstCategory(app: TestApp["app"], sid: string) {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    return json(res).categories as { id: string; name: string }[];
  }

  it("start with an archived category is 409", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "timer_archived");
    const cats = await firstCategory(t.app, sid);
    const work = cats.find((c) => c.name === "工作");
    const study = cats.find((c) => c.name === "学习");
    assert.ok(work && study);

    const archive = await t.app.inject({
      method: "POST",
      url: `/api/categories/${work.id}/archive`,
      headers: cookieHeader(sid),
    });
    assert.equal(archive.statusCode, 200);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(start.statusCode, 409);
    assert.equal((json(start).error as { code: string }).code, "CONFLICT");

    // 活动分类仍可正常启动
    const okStart = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: study.id },
    });
    assert.equal(okStart.statusCode, 200);
  });

  it("update running entry: rebind to archived category is 409; unchanged categoryId passes", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "timer_archived_update");
    const cats = await firstCategory(t.app, sid);
    const work = cats.find((c) => c.name === "工作");
    const study = cats.find((c) => c.name === "学习");
    assert.ok(work && study);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(start.statusCode, 200);

    await t.app.inject({
      method: "POST",
      url: `/api/categories/${work.id}/archive`,
      headers: cookieHeader(sid),
    });

    // 值未变化（categoryId 与运行条目相同）→ 放行，即使分类已归档（保持原分类不改绑）
    const keep = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(keep.statusCode, 200);
    const kept = json(keep).entry as { categoryId: string };
    assert.equal(kept.categoryId, work.id);

    // 附带其它字段 + 原 categoryId 也放行
    const keep2 = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { description: "unchanged cat", categoryId: work.id },
    });
    assert.equal(keep2.statusCode, 200);
    const kept2 = json(keep2).entry as { categoryId: string; description: string };
    assert.equal(kept2.categoryId, work.id);
    assert.equal(kept2.description, "unchanged cat");

    // 换绑到归档分类（从活动分类）→ 409
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: study.id },
    });
    const switchToArchived = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(switchToArchived.statusCode, 409);
  });
});

describe("timer + continuous timing (task 09-08)", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  async function firstCategory(app: TestApp["app"], sid: string) {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    return json(res).categories as { id: string; name: string }[];
  }

  async function setContinuousTiming(app: TestApp["app"], sid: string, enabled: boolean) {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      headers: cookieHeader(sid),
      payload: { continuousTiming: enabled },
    });
    assert.equal(res.statusCode, 200);
    return json(res) as { continuousTiming: boolean };
  }

  it("switch off (default): stop fully stops, no new entry is created (AC3)", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "ct_off");
    const cats = await firstCategory(t.app, sid);

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id, description: "seg one" },
    });

    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);
    const entry = json(stop).entry as { id: string; stoppedAt: string | null };
    assert.ok(entry.stoppedAt !== null);

    // 无运行条目
    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    assert.equal(json(current).entry, null);
  });

  it("switch on: stop closes the old segment and starts a new one seamlessly (AC2)", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "ct_on");
    const cats = await firstCategory(t.app, sid);

    const updated = await setContinuousTiming(t.app, sid, true);
    assert.equal(updated.continuousTiming, true);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id, description: "seg one" },
    });
    assert.equal(start.statusCode, 200);
    const oldId = (json(start).entry as { id: string }).id;

    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);
    const newEntry = json(stop).entry as {
      id: string;
      categoryId: string | null;
      categoryName: string;
      description: string;
      tags: unknown[];
      startedAt: string;
      stoppedAt: string | null;
    };
    assert.notEqual(newEntry.id, oldId);
    // 新段：运行中、未分类、说明空、标签空
    assert.equal(newEntry.stoppedAt, null);
    assert.equal(newEntry.categoryId, null);
    assert.equal(newEntry.categoryName, "未分类");
    assert.equal(newEntry.description, "");
    assert.deepEqual(newEntry.tags, []);

    // current = 新段
    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    const running = json(current).entry as { id: string; stoppedAt: string | null };
    assert.equal(running.id, newEntry.id);
    assert.equal(running.stoppedAt, null);

    // 旧段 stoppedAt === 新段 startedAt（无间隙）
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as {
      id: string;
      stoppedAt: string | null;
      startedAt: string;
    }[];
    const old = entries.find((e) => e.id === oldId);
    assert.ok(old?.stoppedAt);
    assert.equal(old.stoppedAt, newEntry.startedAt);
    // 只有一条运行中
    assert.equal(entries.filter((e) => e.stoppedAt === null).length, 1);
  });

  it("switch on without a running timer is 409, nothing created (AC4)", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "ct_none");
    await setContinuousTiming(t.app, sid, true);

    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 409);
    assert.equal((json(stop).error as { code: string }).code, "CONFLICT");

    // 未创建任何条目
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal((json(today).entries as unknown[]).length, 0);
  });

  it("switching the toggle back off restores full stop (AC6)", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "ct_toggle");
    const cats = await firstCategory(t.app, sid);

    await setContinuousTiming(t.app, sid, true);
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });
    // 无间隙模式停止 → 新段在跑
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    let current = json(
      await t.app.inject({
        method: "GET",
        url: "/api/timer/current",
        headers: cookieHeader(sid),
      }),
    ).entry as { id: string } | null;
    assert.ok(current);

    // 关闭开关（不影响正在运行的条目）后停止 → 完全停止
    await setContinuousTiming(t.app, sid, false);
    current = json(
      await t.app.inject({
        method: "GET",
        url: "/api/timer/current",
        headers: cookieHeader(sid),
      }),
    ).entry as { id: string } | null;
    assert.ok(current); // 运行中条目仍在

    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);
    const entry = json(stop).entry as { stoppedAt: string | null };
    assert.ok(entry.stoppedAt !== null);

    current = json(
      await t.app.inject({
        method: "GET",
        url: "/api/timer/current",
        headers: cookieHeader(sid),
      }),
    ).entry as { id: string } | null;
    assert.equal(current, null);
  });

  it("switch on: the new segment can be re-categorized via PATCH current (R2)", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "ct_recat");
    const cats = await firstCategory(t.app, sid);
    await setContinuousTiming(t.app, sid, true);

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });
    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    const newEntry = json(stop).entry as { id: string; categoryId: string | null };
    assert.equal(newEntry.categoryId, null);

    const upd = await t.app.inject({
      method: "PATCH",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[1].id },
    });
    assert.equal(upd.statusCode, 200);
    const updated = json(upd).entry as { id: string; categoryId: string };
    assert.equal(updated.id, newEntry.id);
    assert.equal(updated.categoryId, cats[1].id);
  });
});

describe("timer timestamps align to whole seconds (task 09-09)", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  async function firstCategory(app: TestApp["app"], sid: string) {
    const res = await app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    return json(res).categories as { id: string; name: string }[];
  }

  it("start truncates startedAt to the second; auto-stopped old entry too (AC1)", async () => {
    let now = new Date("2026-08-25T02:00:10.500Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "ts_start");
    const cats = await firstCategory(t.app, sid);

    const first = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });
    assert.equal(first.statusCode, 200);
    const firstEntry = json(first).entry as { id: string; startedAt: string };
    assert.equal(firstEntry.startedAt, "2026-08-25T02:00:10.000Z");

    // 旧段在运行中时再次 start：旧段被自动停止，stoppedAt 同样为整秒
    now = new Date("2026-08-25T02:00:30.500Z");
    const second = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[1].id },
    });
    assert.equal(second.statusCode, 200);
    const secondEntry = json(second).entry as { id: string; startedAt: string };
    assert.equal(secondEntry.startedAt, "2026-08-25T02:00:30.000Z");

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { id: string; stoppedAt: string | null }[];
    const old = entries.find((e) => e.id === firstEntry.id);
    assert.equal(old?.stoppedAt, "2026-08-25T02:00:30.000Z");
  });

  it("stop truncates stoppedAt to the second; continuous mode keeps the no-gap invariant (AC2)", async () => {
    let now = new Date("2026-08-25T02:00:10.500Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "ts_stop");
    const cats = await firstCategory(t.app, sid);

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });

    // 默认模式：stop → stoppedAt 整秒
    now = new Date("2026-08-25T02:00:50.250Z");
    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);
    const stopped = json(stop).entry as { id: string; stoppedAt: string | null };
    assert.equal(stopped.stoppedAt, "2026-08-25T02:00:50.000Z");

    // 开启无间隙模式：stop → 新段 startedAt = 旧段 stoppedAt，均为整秒
    const profile = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      headers: cookieHeader(sid),
      payload: { continuousTiming: true },
    });
    assert.equal(profile.statusCode, 200);

    now = new Date("2026-08-25T02:01:20.750Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });
    const stop2 = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop2.statusCode, 200);
    const newEntry = json(stop2).entry as { startedAt: string; stoppedAt: string | null };
    assert.equal(newEntry.startedAt, "2026-08-25T02:01:20.000Z");
    assert.equal(newEntry.stoppedAt, null);

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { stoppedAt: string | null }[];
    // 旧段 stoppedAt === 新段 startedAt（无间隙不变量），且均为 .000Z
    const oldSeg = entries.find((e) => e.stoppedAt === "2026-08-25T02:01:20.000Z");
    assert.ok(oldSeg);
    assert.equal(entries.filter((e) => e.stoppedAt === null).length, 1);
  });

  it("entry created at a timer boundary is 201, not 409 OVERLAP (AC3, ghost placeholder regression)", async () => {
    let now = new Date("2026-08-25T02:00:10.500Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "ts_ghost");
    const cats = await firstCategory(t.app, sid);

    // 用计时器产生相邻整秒条目：start → stop → start → stop
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[0].id },
    });
    now = new Date("2026-08-25T02:00:30.500Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    now = new Date("2026-08-25T02:00:30.500Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: cats[1].id },
    });
    now = new Date("2026-08-25T02:00:45.500Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });

    // 幽灵占位场景：创建一条「起点 = 前条目 stoppedAt」的条目（编辑器读出即秒精度）
    const create = await t.app.inject({
      method: "POST",
      url: "/api/entries",
      headers: cookieHeader(sid),
      payload: {
        description: "ghost slot",
        categoryId: cats[0].id,
        tagIds: [],
        startedAt: "2026-08-25T02:00:45.000Z",
        stoppedAt: "2026-08-25T02:00:50.000Z",
      },
    });
    assert.equal(create.statusCode, 201);
    const created = json(create).entry as { startedAt: string };
    assert.equal(created.startedAt, "2026-08-25T02:00:45.000Z");
  });
});
