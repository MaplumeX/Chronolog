import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import Database from "better-sqlite3";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

type Clock = { value: Date };

describe("entries", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  async function categories(sid: string) {
    const res = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    return json(res).categories as { id: string; name: string }[];
  }

  async function createTag(sid: string, name: string) {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name },
    });
    assert.equal(res.statusCode, 200);
    return json(res).id as string;
  }

  /** 用 start/stop 创建一条 [startIso, stopIso] 的已停止条目，返回其 id。 */
  async function createStopped(
    sid: string,
    categoryId: string,
    c: Clock,
    startIso: string,
    stopIso: string,
    opts: { description?: string; tagIds?: string[] } = {},
  ) {
    c.value = new Date(startIso);
    const startRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId, description: opts.description, tagIds: opts.tagIds },
    });
    assert.equal(startRes.statusCode, 200);
    const id = (json(startRes).entry as { id: string }).id;
    c.value = new Date(stopIso);
    const stopRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stopRes.statusCode, 200);
    return id;
  }

  it("edits description, category and tags; returns updated entry", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "editor");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    const study = cats.find((x) => x.name === "学习");
    assert.ok(work && study);
    const tagA = await createTag(sid, "深度");
    const tagB = await createTag(sid, "专注");
    const id = await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z", {
      description: "old",
      tagIds: [tagA],
    });

    const res = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "new desc",
        categoryId: study.id,
        tagIds: [tagB],
        startedAt: "2026-08-25T02:00:00.000Z",
        stoppedAt: "2026-08-25T02:30:00.000Z",
      },
    });
    assert.equal(res.statusCode, 200);
    const entry = json(res).entry as {
      id: string;
      description: string;
      categoryId: string;
      categoryName: string;
      startedAt: string;
      stoppedAt: string;
      durationSeconds: number;
      tags: { id: string; name: string }[];
    };
    assert.equal(entry.id, id);
    assert.equal(entry.description, "new desc");
    assert.equal(entry.categoryId, study.id);
    assert.equal(entry.categoryName, "学习");
    assert.equal(entry.startedAt, "2026-08-25T02:00:00.000Z");
    assert.equal(entry.stoppedAt, "2026-08-25T02:30:00.000Z");
    assert.equal(entry.durationSeconds, 1800);
    assert.deepEqual(entry.tags.map((x) => x.id), [tagB]);
  });

  it("editing times moves the entry in today/week lists", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "mover");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const id = await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z");

    const res = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "",
        categoryId: work.id,
        tagIds: [],
        startedAt: "2026-08-25T03:00:00.000Z",
        stoppedAt: "2026-08-25T04:00:00.000Z",
      },
    });
    assert.equal(res.statusCode, 200);
    const entry = json(res).entry as { startedAt: string; stoppedAt: string; durationSeconds: number };
    assert.equal(entry.startedAt, "2026-08-25T03:00:00.000Z");
    assert.equal(entry.stoppedAt, "2026-08-25T04:00:00.000Z");
    assert.equal(entry.durationSeconds, 3600);

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as {
      id: string;
      startedAt: string;
      durationSeconds: number;
      clippedSeconds: number;
    }[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, id);
    assert.equal(entries[0].startedAt, "2026-08-25T03:00:00.000Z");
    assert.equal(entries[0].clippedSeconds, 3600);

    const week = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=UTC",
      headers: cookieHeader(sid),
    });
    const days = json(week).days as { entries: { id: string; startedAt: string }[] }[];
    assert.equal(days.length, 7);
    const tuesday = days[1]; // 2026-08-25 是周二
    assert.ok(tuesday.entries.some((e) => e.id === id && e.startedAt === "2026-08-25T03:00:00.000Z"));
  });

  it("foreign or missing entry is 404", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const a = await registerUser(t.app, "alice_edit");
    const b = await registerUser(t.app, "bob_edit");
    const cats = await categories(a.sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const id = await createStopped(a.sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z");

    const payload = {
      description: "x",
      categoryId: work.id,
      tagIds: [],
      startedAt: "2026-08-25T02:00:00.000Z",
      stoppedAt: "2026-08-25T02:30:00.000Z",
    };
    const foreign = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(b.sid),
      payload,
    });
    assert.equal(foreign.statusCode, 404);
    assert.equal((json(foreign).error as { code: string }).code, "NOT_FOUND");

    const missing = await t.app.inject({
      method: "PATCH",
      url: "/api/entries/no-such-entry",
      headers: cookieHeader(a.sid),
      payload,
    });
    assert.equal(missing.statusCode, 404);
  });

  it("running entry is 409", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "runner_edit");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    c.value = new Date("2026-08-25T02:00:00.000Z");
    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(start.statusCode, 200);
    const id = (json(start).entry as { id: string }).id;

    const res = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "x",
        categoryId: work.id,
        tagIds: [],
        startedAt: "2026-08-25T02:00:00.000Z",
        stoppedAt: "2026-08-25T02:30:00.000Z",
      },
    });
    assert.equal(res.statusCode, 409);
    assert.equal((json(res).error as { code: string }).code, "CONFLICT");
  });

  it("foreign or missing category/tag is 404", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const a = await registerUser(t.app, "alice_cat");
    const b = await registerUser(t.app, "bob_cat");
    const cats = await categories(a.sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const id = await createStopped(a.sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z");

    const bCats = await categories(b.sid);
    const bCat = bCats[0];
    const base = {
      description: "x",
      tagIds: [],
      startedAt: "2026-08-25T02:00:00.000Z",
      stoppedAt: "2026-08-25T02:30:00.000Z",
    };

    const foreignCat = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(a.sid),
      payload: { ...base, categoryId: bCat.id },
    });
    assert.equal(foreignCat.statusCode, 404);

    const missingCat = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(a.sid),
      payload: { ...base, categoryId: "no-such-cat" },
    });
    assert.equal(missingCat.statusCode, 404);

    const missingTag = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(a.sid),
      payload: { ...base, categoryId: work.id, tagIds: ["no-such-tag"] },
    });
    assert.equal(missingTag.statusCode, 404);
  });

  it("invalid times or too-long description are 400", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "invalid_edit");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const id = await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z");

    const base = { description: "x", categoryId: work.id, tagIds: [] };

    const equal = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T02:00:00.000Z", stoppedAt: "2026-08-25T02:00:00.000Z" },
    });
    assert.equal(equal.statusCode, 400);
    assert.equal((json(equal).error as { code: string }).code, "VALIDATION");

    const before = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T03:00:00.000Z", stoppedAt: "2026-08-25T02:00:00.000Z" },
    });
    assert.equal(before.statusCode, 400);

    const long = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        ...base,
        description: "x".repeat(201),
        startedAt: "2026-08-25T02:00:00.000Z",
        stoppedAt: "2026-08-25T02:30:00.000Z",
      },
    });
    assert.equal(long.statusCode, 400);

    const badFormat = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "not-a-date", stoppedAt: "2026-08-25T02:30:00.000Z" },
    });
    assert.equal(badFormat.statusCode, 400);
  });

  it("overlap with stopped or running entries is 409; touching edges are fine", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "overlap_edit");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    // 已有条目 A: 02:00–03:00，B: 04:00–05:00
    const aId = await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T03:00:00.000Z");
    const bId = await createStopped(sid, work.id, c, "2026-08-25T04:00:00.000Z", "2026-08-25T05:00:00.000Z");

    const base = { description: "x", categoryId: work.id, tagIds: [] };

    // 与 A 重叠（start 落在 A 内）
    const overlapA = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${bId}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T02:30:00.000Z", stoppedAt: "2026-08-25T04:30:00.000Z" },
    });
    assert.equal(overlapA.statusCode, 409);
    assert.equal((json(overlapA).error as { code: string }).code, "OVERLAP");

    // 与 B 重叠（end 落在 B 内）
    const overlapB = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${aId}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T03:30:00.000Z", stoppedAt: "2026-08-25T04:30:00.000Z" },
    });
    assert.equal(overlapB.statusCode, 409);

    // 失败的编辑不改变原数据
    const after = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const aAfter = (json(after).entries as { id: string; startedAt: string; stoppedAt: string }[]).find(
      (e) => e.id === aId,
    );
    assert.equal(aAfter?.startedAt, "2026-08-25T02:00:00.000Z");
    assert.equal(aAfter?.stoppedAt, "2026-08-25T03:00:00.000Z");

    // 边界相接：A 结束 == B 开始，不冲突
    const touching = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${aId}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T02:00:00.000Z", stoppedAt: "2026-08-25T04:00:00.000Z" },
    });
    assert.equal(touching.statusCode, 200);

    // 运行中条目 06:00 开始，延伸到无穷；与其重叠 → 409
    c.value = new Date("2026-08-25T06:00:00.000Z");
    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(start.statusCode, 200);

    const overlapRunning = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${aId}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T05:00:00.000Z", stoppedAt: "2026-08-25T07:00:00.000Z" },
    });
    assert.equal(overlapRunning.statusCode, 409);

    // 结束时间恰好等于运行中条目开始时间 → 不冲突（用 B：B 在 [05:00, 06:00) 不与 A 或运行中条目重叠）
    const beforeRunning = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${bId}`,
      headers: cookieHeader(sid),
      payload: { ...base, startedAt: "2026-08-25T05:00:00.000Z", stoppedAt: "2026-08-25T06:00:00.000Z" },
    });
    assert.equal(beforeRunning.statusCode, 200);
  });

  it("replaces old tags with new ones", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "tag_replace");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const tagA = await createTag(sid, "深度");
    const tagB = await createTag(sid, "专注");
    const tagC = await createTag(sid, "会议");
    const id = await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z", {
      tagIds: [tagA, tagB],
    });

    const res = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "",
        categoryId: work.id,
        tagIds: [tagC],
        startedAt: "2026-08-25T02:00:00.000Z",
        stoppedAt: "2026-08-25T02:30:00.000Z",
      },
    });
    assert.equal(res.statusCode, 200);
    const entry = json(res).entry as { tags: { id: string; name: string }[] };
    assert.deepEqual(entry.tags.map((x) => x.id), [tagC]);

    // 清空标签
    const cleared = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "",
        categoryId: work.id,
        tagIds: [],
        startedAt: "2026-08-25T02:00:00.000Z",
        stoppedAt: "2026-08-25T02:30:00.000Z",
      },
    });
    assert.equal(cleared.statusCode, 200);
    assert.deepEqual((json(cleared).entry as { tags: unknown[] }).tags, []);
  });

  describe("POST /api/entries", () => {
    it("creates an entry and returns the EntryDto; visible in today", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const { sid } = await registerUser(t.app, "creator");
      const cats = await categories(sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      const tagA = await createTag(sid, "深度");

      const res = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: {
          description: "补录",
          categoryId: work.id,
          tagIds: [tagA],
          startedAt: "2026-08-25T02:00:00.000Z",
          stoppedAt: "2026-08-25T03:30:00.000Z",
        },
      });
      assert.equal(res.statusCode, 201);
      const entry = json(res).entry as {
        id: string;
        description: string;
        categoryId: string;
        categoryName: string;
        startedAt: string;
        stoppedAt: string;
        durationSeconds: number;
        tags: { id: string; name: string }[];
      };
      assert.ok(entry.id);
      assert.equal(entry.description, "补录");
      assert.equal(entry.categoryId, work.id);
      assert.equal(entry.categoryName, "工作");
      assert.equal(entry.startedAt, "2026-08-25T02:00:00.000Z");
      assert.equal(entry.stoppedAt, "2026-08-25T03:30:00.000Z");
      assert.equal(entry.durationSeconds, 5400);
      assert.deepEqual(entry.tags.map((x) => x.id), [tagA]);

      const today = await t.app.inject({
        method: "GET",
        url: "/api/entries/today?tz=UTC",
        headers: cookieHeader(sid),
      });
      const entries = json(today).entries as { id: string; durationSeconds: number }[];
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, entry.id);
      assert.equal(entries[0].durationSeconds, 5400);
    });

    it("stoppedAt <= startedAt is 400 VALIDATION", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const { sid } = await registerUser(t.app, "creator_bad_time");
      const cats = await categories(sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      const base = { description: "x", categoryId: work.id, tagIds: [] };

      const equal = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T02:00:00.000Z", stoppedAt: "2026-08-25T02:00:00.000Z" },
      });
      assert.equal(equal.statusCode, 400);
      assert.equal((json(equal).error as { code: string }).code, "VALIDATION");

      const before = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T03:00:00.000Z", stoppedAt: "2026-08-25T02:00:00.000Z" },
      });
      assert.equal(before.statusCode, 400);
    });

    it("foreign or missing category/tag is 404", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const a = await registerUser(t.app, "alice_create");
      const b = await registerUser(t.app, "bob_create");
      const aCats = await categories(a.sid);
      const work = aCats.find((x) => x.name === "工作");
      assert.ok(work);
      const bCats = await categories(b.sid);
      const bCat = bCats[0];
      const bTag = await createTag(b.sid, "他人标签");
      const base = {
        description: "x",
        startedAt: "2026-08-25T02:00:00.000Z",
        stoppedAt: "2026-08-25T03:00:00.000Z",
      };

      const foreignCat = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(a.sid),
        payload: { ...base, categoryId: bCat.id, tagIds: [] },
      });
      assert.equal(foreignCat.statusCode, 404);
      assert.equal((json(foreignCat).error as { code: string }).code, "NOT_FOUND");

      const missingCat = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(a.sid),
        payload: { ...base, categoryId: "no-such-cat", tagIds: [] },
      });
      assert.equal(missingCat.statusCode, 404);

      const foreignTag = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(a.sid),
        payload: { ...base, categoryId: work.id, tagIds: [bTag] },
      });
      assert.equal(foreignTag.statusCode, 404);
    });

    it("overlaps with existing entries are 409; touching edges are fine", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const { sid } = await registerUser(t.app, "overlap_create");
      const cats = await categories(sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      // 已有条目 A: 02:00–03:00
      await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T03:00:00.000Z");
      const base = { description: "x", categoryId: work.id, tagIds: [] };

      // 与 A 重叠
      const overlap = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T02:30:00.000Z", stoppedAt: "2026-08-25T04:00:00.000Z" },
      });
      assert.equal(overlap.statusCode, 409);
      assert.equal((json(overlap).error as { code: string }).code, "OVERLAP");

      // 边界相接：新条目 [03:00, 04:00) 与 A [02:00, 03:00) 不冲突
      const touching = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T03:00:00.000Z", stoppedAt: "2026-08-25T04:00:00.000Z" },
      });
      assert.equal(touching.statusCode, 201);

      // 运行中条目 06:00 开始延伸到无穷，与其重叠 → 409
      c.value = new Date("2026-08-25T06:00:00.000Z");
      const start = await t.app.inject({
        method: "POST",
        url: "/api/timer/start",
        headers: cookieHeader(sid),
        payload: { categoryId: work.id },
      });
      assert.equal(start.statusCode, 200);

      const overlapRunning = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T05:00:00.000Z", stoppedAt: "2026-08-25T07:00:00.000Z" },
      });
      assert.equal(overlapRunning.statusCode, 409);

      // 结束时间恰好等于运行中条目开始时间 → 不冲突
      const beforeRunning = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T04:30:00.000Z", stoppedAt: "2026-08-25T05:00:00.000Z" },
      });
      assert.equal(beforeRunning.statusCode, 201);
    });

    it("normalizes millisecond-less / varied-precision ISO strings (mixed-format regression)", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const { sid } = await registerUser(t.app, "mixed_format");
      const cats = await categories(sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      const base = { description: "x", categoryId: work.id, tagIds: [] };

      // 存量条目以无毫秒格式创建：入库后返回值恒为 .000Z 格式
      const legacy = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T02:00:00Z", stoppedAt: "2026-08-25T03:00:00Z" },
      });
      assert.equal(legacy.statusCode, 201);
      const legacyEntry = json(legacy).entry as { startedAt: string; stoppedAt: string };
      assert.equal(legacyEntry.startedAt, "2026-08-25T02:00:00.000Z");
      assert.equal(legacyEntry.stoppedAt, "2026-08-25T03:00:00.000Z");

      // 边界相接（新条目 start == 存量 end）：存量已规范化为 .000Z，不误报 409
      const touching = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T03:00:00.000Z", stoppedAt: "2026-08-25T03:30:00.000Z" },
      });
      assert.equal(touching.statusCode, 201);

      // 无毫秒/毫秒混比不再误报顺序错误：stoppedAt 比 startedAt 晚 0.5s，但宁典序 '...00.5Z' > '...00Z' 曾误判为 <=
      const halfSec = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T04:00:00Z", stoppedAt: "2026-08-25T04:00:00.5Z" },
      });
      assert.equal(halfSec.statusCode, 201);
      const halfSecEntry = json(halfSec).entry as { startedAt: string; stoppedAt: string };
      assert.equal(halfSecEntry.startedAt, "2026-08-25T04:00:00.000Z");
      assert.equal(halfSecEntry.stoppedAt, "2026-08-25T04:00:00.500Z");

      // 毫秒位数不同（.125Z）也统一为 3 位毫秒格式
      const millis = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T05:00:00.125Z", stoppedAt: "2026-08-25T05:10:00Z" },
      });
      assert.equal(millis.statusCode, 201);
      const millisEntry = json(millis).entry as { startedAt: string; stoppedAt: string };
      assert.equal(millisEntry.startedAt, "2026-08-25T05:00:00.125Z");
      assert.equal(millisEntry.stoppedAt, "2026-08-25T05:10:00.000Z");

      // PATCH 同一 schema 边界：无毫秒/毫秒混格式编辑也规范化为 .000Z，不误报 400/409
      const patchId = await createStopped(
        sid,
        work.id,
        c,
        "2026-08-25T06:00:00.000Z",
        "2026-08-25T07:00:00.000Z",
      );
      const patched = await t.app.inject({
        method: "PATCH",
        url: `/api/entries/${patchId}`,
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T06:30:00.5Z", stoppedAt: "2026-08-25T07:00:00Z" },
      });
      assert.equal(patched.statusCode, 200);
      const patchedEntry = json(patched).entry as { startedAt: string; stoppedAt: string };
      assert.equal(patchedEntry.startedAt, "2026-08-25T06:30:00.500Z");
      assert.equal(patchedEntry.stoppedAt, "2026-08-25T07:00:00.000Z");

      // 真实重叠不漏检：存量 02:00–03:00（无毫秒格式创建、入库已规范化），新条目 02:30 开始 → 409
      const overlap = await t.app.inject({
        method: "POST",
        url: "/api/entries",
        headers: cookieHeader(sid),
        payload: { ...base, startedAt: "2026-08-25T02:30:00.000Z", stoppedAt: "2026-08-25T02:40:00.000Z" },
      });
      assert.equal(overlap.statusCode, 409);
      assert.equal((json(overlap).error as { code: string }).code, "OVERLAP");
    });
  });

  describe("DELETE /api/entries/:id", () => {
    it("deletes a stopped entry; entry_tags rows are cascade-cleared", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const { sid } = await registerUser(t.app, "deleter");
      const cats = await categories(sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      const tagA = await createTag(sid, "深度");
      const id = await createStopped(sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z", {
        tagIds: [tagA],
      });

      const res = await t.app.inject({
        method: "DELETE",
        url: `/api/entries/${id}`,
        headers: cookieHeader(sid),
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(json(res), { ok: true });

      // today 列表不再包含该条目
      const today = await t.app.inject({
        method: "GET",
        url: "/api/entries/today?tz=UTC",
        headers: cookieHeader(sid),
      });
      const entries = json(today).entries as { id: string }[];
      assert.equal(entries.length, 0);

      // entry_tags 行被 ON DELETE CASCADE 清理（标签本身保留）
      const tagsRes = await t.app.inject({
        method: "GET",
        url: "/api/tags",
        headers: cookieHeader(sid),
      });
      const tagRow = (json(tagsRes).tags as { id: string; entryCount: number }[]).find(
        (x) => x.id === tagA,
      );
      assert.ok(tagRow);
      assert.equal(tagRow.entryCount, 0);

      // 再次删除 → 404
      const again = await t.app.inject({
        method: "DELETE",
        url: `/api/entries/${id}`,
        headers: cookieHeader(sid),
      });
      assert.equal(again.statusCode, 404);
    });

    it("running entry is 409", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const { sid } = await registerUser(t.app, "runner_delete");
      const cats = await categories(sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      const start = await t.app.inject({
        method: "POST",
        url: "/api/timer/start",
        headers: cookieHeader(sid),
        payload: { categoryId: work.id },
      });
      assert.equal(start.statusCode, 200);
      const id = (json(start).entry as { id: string }).id;

      const res = await t.app.inject({
        method: "DELETE",
        url: `/api/entries/${id}`,
        headers: cookieHeader(sid),
      });
      assert.equal(res.statusCode, 409);
      assert.equal((json(res).error as { code: string }).code, "CONFLICT");

      // 计时器仍在运行
      const current = await t.app.inject({
        method: "GET",
        url: "/api/timer/current",
        headers: cookieHeader(sid),
      });
      assert.equal((json(current).entry as { id: string } | null)?.id, id);
    });

    it("foreign or missing entry is 404", async () => {
      const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
      t = await createTestApp({ now: () => c.value });
      const a = await registerUser(t.app, "alice_delete");
      const b = await registerUser(t.app, "bob_delete");
      const cats = await categories(a.sid);
      const work = cats.find((x) => x.name === "工作");
      assert.ok(work);
      const id = await createStopped(a.sid, work.id, c, "2026-08-25T02:00:00.000Z", "2026-08-25T02:30:00.000Z");

      const foreign = await t.app.inject({
        method: "DELETE",
        url: `/api/entries/${id}`,
        headers: cookieHeader(b.sid),
      });
      assert.equal(foreign.statusCode, 404);
      assert.equal((json(foreign).error as { code: string }).code, "NOT_FOUND");

      const missing = await t.app.inject({
        method: "DELETE",
        url: "/api/entries/no-such-entry",
        headers: cookieHeader(a.sid),
      });
      assert.equal(missing.statusCode, 404);

      // 他人删除失败后条目仍在
      const today = await t.app.inject({
        method: "GET",
        url: "/api/entries/today?tz=UTC",
        headers: cookieHeader(a.sid),
      });
      assert.equal((json(today).entries as { id: string }[]).length, 1);
    });
  });
});

describe("POST /api/entries/:id/merge (task 09-08)", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  async function categories(sid: string) {
    const res = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    return json(res).categories as { id: string; name: string }[];
  }

  async function createTag(sid: string, name: string) {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name },
    });
    assert.equal(res.statusCode, 200);
    return json(res).id as string;
  }

  async function createStopped(
    sid: string,
    categoryId: string,
    c: Clock,
    startIso: string,
    stopIso: string,
    opts: { description?: string; tagIds?: string[] } = {},
  ) {
    c.value = new Date(startIso);
    const startRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId, description: opts.description, tagIds: opts.tagIds },
    });
    assert.equal(startRes.statusCode, 200);
    const id = (json(startRes).entry as { id: string }).id;
    c.value = new Date(stopIso);
    const stopRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stopRes.statusCode, 200);
    return id;
  }

  async function merge(
    sid: string,
    id: string,
    payload: { direction: "prev" | "next"; keep: "self" | "other" },
  ) {
    return t.app.inject({
      method: "POST",
      url: `/api/entries/${id}/merge`,
      headers: cookieHeader(sid),
      payload,
    });
  }

  it("merges prev direction keeping self attributes (AC1)", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_prev");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    const study = cats.find((x) => x.name === "学习");
    assert.ok(work && study);
    const tagA = await createTag(sid, "深度");
    const tagB = await createTag(sid, "专注");
    // A（早）：工作 + tagA；B（晚）：学习 + tagB，中间有 1h 空隙
    await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z", {
      description: "A",
      tagIds: [tagA],
    });
    const bId = await createStopped(sid, study.id, c, "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z", {
      description: "B",
      tagIds: [tagB],
    });

    const res = await merge(sid, bId, { direction: "prev", keep: "self" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const entry = json(res).entry as {
      id: string;
      description: string;
      categoryId: string;
      startedAt: string;
      stoppedAt: string;
      durationSeconds: number;
      tags: { id: string }[];
    };
    // 区间覆盖两段 + 空隙；属性 = B（self）
    assert.equal(entry.id, bId);
    assert.equal(entry.startedAt, "2026-08-25T01:00:00.000Z");
    assert.equal(entry.stoppedAt, "2026-08-25T04:00:00.000Z");
    assert.equal(entry.durationSeconds, 3 * 3600);
    assert.equal(entry.description, "B");
    assert.equal(entry.categoryId, study.id);
    assert.deepEqual(entry.tags.map((x) => x.id), [tagB]);

    // 只剩一条，且是 bId
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { id: string }[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, bId);

    // 被并入条的标签被 CASCADE 清理（entryCount 归 0）
    const tagsRes = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sid),
    });
    const tagRow = (json(tagsRes).tags as { id: string; entryCount: number }[]).find((x) => x.id === tagA);
    assert.ok(tagRow);
    assert.equal(tagRow.entryCount, 0);
  });

  it("merges next direction keeping other attributes (AC2)", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_next");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    const study = cats.find((x) => x.name === "学习");
    assert.ok(work && study);
    const tagA = await createTag(sid, "深度");
    const tagB = await createTag(sid, "专注");
    const aId = await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z", {
      description: "A",
      tagIds: [tagA],
    });
    const bId = await createStopped(sid, study.id, c, "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z", {
      description: "B",
      tagIds: [tagB],
    });

    // 在 A 上「与下一条合并」，属性保留 B（other）：keep 条 = B（被删 = A）
    const res = await merge(sid, aId, { direction: "next", keep: "other" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const entry = json(res).entry as {
      id: string;
      description: string;
      categoryId: string;
      startedAt: string;
      stoppedAt: string;
      tags: { id: string }[];
    };
    assert.equal(entry.id, bId);
    assert.equal(entry.startedAt, "2026-08-25T01:00:00.000Z");
    assert.equal(entry.stoppedAt, "2026-08-25T04:00:00.000Z");
    assert.equal(entry.description, "B");
    assert.equal(entry.categoryId, study.id);
    assert.deepEqual(entry.tags.map((x) => x.id), [tagB]);

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { id: string }[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, bId);
  });

  it("merges across a gap without OVERLAP (AC3); touching entries too", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_gap");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    // 大空隙：前一天 ↔ 当天（跨天）
    await createStopped(sid, work.id, c, "2026-08-24T20:00:00.000Z", "2026-08-24T21:00:00.000Z");
    const bId = await createStopped(sid, work.id, c, "2026-08-25T10:00:00.000Z", "2026-08-25T11:00:00.000Z");

    const res = await merge(sid, bId, { direction: "prev", keep: "self" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const entry = json(res).entry as { id: string; startedAt: string; stoppedAt: string; durationSeconds: number };
    assert.equal(entry.startedAt, "2026-08-24T20:00:00.000Z");
    assert.equal(entry.stoppedAt, "2026-08-25T11:00:00.000Z");
    assert.equal(entry.durationSeconds, 15 * 3600);

    // 边界相接（无空隙）也可合并
    const cId = await createStopped(sid, work.id, c, "2026-08-25T12:00:00.000Z", "2026-08-25T13:00:00.000Z");
    const touching = await merge(sid, entry.id, { direction: "next", keep: "self" });
    assert.equal(touching.statusCode, 200, JSON.stringify(touching.json()));
    const touchingEntry = json(touching).entry as { startedAt: string; stoppedAt: string; id: string };
    assert.equal(touchingEntry.startedAt, "2026-08-24T20:00:00.000Z");
    assert.equal(touchingEntry.stoppedAt, "2026-08-25T13:00:00.000Z");
    // cId 已被并入
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal((json(today).entries as { id: string }[]).filter((e) => e.id === cId).length, 0);
  });

  it("running entries are rejected in both directions (AC4)", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_running");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    // A（早，已停止），B（晚，运行中）
    const aId = await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z");
    c.value = new Date("2026-08-25T03:00:00.000Z");
    const startB = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(startB.statusCode, 200);
    const bId = (json(startB).entry as { id: string }).id;

    // B（self）运行中 → 409
    const resB = await merge(sid, bId, { direction: "prev", keep: "self" });
    assert.equal(resB.statusCode, 409);
    assert.equal((json(resB).error as { code: string; message: string }).code, "CONFLICT");

    // A 合并 next，相邻条 B 运行中 → 409
    const resA = await merge(sid, aId, { direction: "next", keep: "self" });
    assert.equal(resA.statusCode, 409);
    assert.equal((json(resA).error as { code: string }).code, "CONFLICT");

    // 原数据未变：A 仍在，B 仍在运行
    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    assert.equal((json(current).entry as { id: string } | null)?.id, bId);
  });

  it("non-adjacent entries (third in between) are 409 (AC5)", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_far");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    // A（01:00–02:00）C（02:30–02:40）B（03:00–04:00）：对 B 调 prev 的相邻条是 C（服务端权威），合并 B+C 后应只剩 2 条
    await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z");
    const cId = await createStopped(sid, work.id, c, "2026-08-25T02:30:00.000Z", "2026-08-25T02:40:00.000Z");
    const bId = await createStopped(sid, work.id, c, "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z");

    // 正常 API 无法进设出「跳过中间条」的合并请求（服务端总会重判出紧邻的 C）；
    // 直接写库模拟脏数据：把 C 改为运行中并横跨在 A 与 B 之间（违反 API 不变量的极端并发场景），
    // 再对 B 调 prev（此时 prev 候选为 A）→ 相邻性重判必须拒绝
    const db = new Database(t.dbPath);
    db.prepare("UPDATE time_entries SET stopped_at = NULL WHERE id = ?").run(cId);
    db.close();

    const res = await merge(sid, bId, { direction: "prev", keep: "self" });
    assert.equal(res.statusCode, 409, JSON.stringify(res.json()));
    const error = json(res).error as { code: string; message: string };
    assert.equal(error.code, "CONFLICT");
    assert.equal(error.message, "条目不相邻");

    // 数据未变：3 条都在（事务回滚）
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal((json(today).entries as { id: string }[]).length, 3);

    // 对照：没有脏数据时（删掉 C）同一请求成功
    const db2 = new Database(t.dbPath);
    db2.prepare("DELETE FROM time_entries WHERE id = ?").run(cId);
    db2.close();
    const ok = await merge(sid, bId, { direction: "prev", keep: "self" });
    assert.equal(ok.statusCode, 200, JSON.stringify(ok.json()));
    const merged = json(ok).entry as { startedAt: string; stoppedAt: string };
    assert.equal(merged.startedAt, "2026-08-25T01:00:00.000Z");
    assert.equal(merged.stoppedAt, "2026-08-25T04:00:00.000Z");
  });

  it("foreign or missing entry is 404 (AC5)", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const a = await registerUser(t.app, "alice_merge");
    const b = await registerUser(t.app, "bob_merge");
    const cats = await categories(a.sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const id = await createStopped(a.sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z");
    await createStopped(a.sid, work.id, c, "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z");

    const foreign = await merge(b.sid, id, { direction: "prev", keep: "self" });
    assert.equal(foreign.statusCode, 404);
    assert.equal((json(foreign).error as { code: string }).code, "NOT_FOUND");

    const missing = await merge(a.sid, "no-such-entry", { direction: "prev", keep: "self" });
    assert.equal(missing.statusCode, 404);

    // 条目未被合并
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(a.sid),
    });
    assert.equal((json(today).entries as { id: string }[]).length, 2);
  });

  it("no previous entry is 409", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_first");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const bId = await createStopped(sid, work.id, c, "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z");

    const res = await merge(sid, bId, { direction: "prev", keep: "self" });
    assert.equal(res.statusCode, 409);
    assert.equal((json(res).error as { code: string; message: string }).code, "CONFLICT");
    assert.equal((json(res).error as { message: string }).message, "没有可合并的上一条");

    const next = await merge(sid, bId, { direction: "next", keep: "self" });
    assert.equal(next.statusCode, 409);
    assert.equal((json(next).error as { message: string }).message, "没有可合并的下一条");
  });

  it("invalid body is 400", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_bad_body");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const id = await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z");

    const badDirection = await merge(sid, id, { direction: "up", keep: "self" } as never);
    assert.equal(badDirection.statusCode, 400);
    assert.equal((json(badDirection).error as { code: string }).code, "VALIDATION");

    const missingKeep = await merge(sid, id, { direction: "prev" } as never);
    assert.equal(missingKeep.statusCode, 400);
  });

  it("merged entry with tags: entry_tags of the deleted entry are cleaned, keep entry tags intact", async () => {
    const c: Clock = { value: new Date("2026-08-25T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "merge_tags");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);
    const tagA = await createTag(sid, "深度");
    const tagB = await createTag(sid, "专注");
    const tagC = await createTag(sid, "会议");
    // keep 条带 tagA+tagB，被并入条带 tagC
    const aId = await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z", {
      tagIds: [tagA, tagB],
    });
    const bId = await createStopped(sid, work.id, c, "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z", {
      tagIds: [tagC],
    });

    // 合并保留 A（在 B 上调 prev，keep = other）
    const res = await merge(sid, bId, { direction: "prev", keep: "other" });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const entry = json(res).entry as { id: string; tags: { id: string; name: string }[] };
    assert.equal(entry.id, aId);
    // 按 name 排序：专注、深度
    assert.deepEqual(entry.tags.map((x) => x.id), [tagB, tagA]);

    // entry_tags 验证：通过标签 entryCount 确认 bId 的关联行已 CASCADE 清理，aId 的保留
    const tagsRes = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sid),
    });
    const tagRows = json(tagsRes).tags as { id: string; entryCount: number }[];
    assert.deepEqual(
      tagRows.filter((x) => [tagA, tagB, tagC].includes(x.id)).map((x) => [x.id, x.entryCount]),
      [
        [tagA, 1],
        [tagB, 1],
        [tagC, 0],
      ],
    );
  });
});

describe("entries + archived categories (task 08-31)", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  async function categories(sid: string) {
    const res = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    return json(res).categories as { id: string; name: string }[];
  }

  async function archiveCategory(sid: string, id: string) {
    const res = await t.app.inject({
      method: "POST",
      url: `/api/categories/${id}/archive`,
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
  }

  it("creating or rebinding an entry to an archived category is 409; unchanged categoryId passes", async () => {
    const c: Clock = { value: new Date("2026-08-31T02:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "entry_archived");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    const study = cats.find((x) => x.name === "学习");
    assert.ok(work && study);

    // 造一条已停止条目后归档其分类
    c.value = new Date("2026-08-31T01:00:00.000Z");
    const startRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(startRes.statusCode, 200);
    const id = (json(startRes).entry as { id: string }).id;
    c.value = new Date("2026-08-31T02:00:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    await archiveCategory(sid, work.id);

    // POST 新建指向归档分类 → 409
    const create = await t.app.inject({
      method: "POST",
      url: "/api/entries",
      headers: cookieHeader(sid),
      payload: {
        description: "new",
        categoryId: work.id,
        tagIds: [],
        startedAt: "2026-08-31T04:00:00.000Z",
        stoppedAt: "2026-08-31T04:30:00.000Z",
      },
    });
    assert.equal(create.statusCode, 409);
    assert.equal((json(create).error as { code: string }).code, "CONFLICT");

    // PATCH 保持原分类（值未变化）→ 放行
    const keep = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "kept",
        categoryId: work.id,
        tagIds: [],
        startedAt: "2026-08-31T01:00:00.000Z",
        stoppedAt: "2026-08-31T02:00:00.000Z",
      },
    });
    assert.equal(keep.statusCode, 200);
    assert.equal((json(keep).entry as { categoryId: string }).categoryId, work.id);

    // PATCH 从活动分类切回归档分类 → 409
    const rebind = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "rebind",
        categoryId: study.id,
        tagIds: [],
        startedAt: "2026-08-31T01:00:00.000Z",
        stoppedAt: "2026-08-31T02:00:00.000Z",
      },
    });
    assert.equal(rebind.statusCode, 200);
    const rebindBack = await t.app.inject({
      method: "PATCH",
      url: `/api/entries/${id}`,
      headers: cookieHeader(sid),
      payload: {
        description: "rebind back",
        categoryId: work.id,
        tagIds: [],
        startedAt: "2026-08-31T01:00:00.000Z",
        stoppedAt: "2026-08-31T02:00:00.000Z",
      },
    });
    assert.equal(rebindBack.statusCode, 409);
    assert.equal((json(rebindBack).error as { code: string }).code, "CONFLICT");
  });

  it("uncategorized entries (categoryId null) appear in lists and stats with 未分类 bucket", async () => {
    const c: Clock = { value: new Date("2026-08-31T03:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "entry_uncat");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);

    c.value = new Date("2026-08-31T02:00:00.000Z");
    const startRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    const id = (json(startRes).entry as { id: string }).id;
    c.value = new Date("2026-08-31T03:00:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });

    // 删除分类 → 条目变未分类
    const del = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${work.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(del.statusCode, 200);

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal(today.statusCode, 200);
    const entries = json(today).entries as { id: string; categoryId: string | null; categoryName: string }[];
    const entry = entries.find((e) => e.id === id);
    assert.ok(entry);
    assert.equal(entry.categoryId, null);
    assert.equal(entry.categoryName, "未分类");

    // 今日统计：未分类自成一组
    const statsToday = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const todayCats = json(statsToday).categories as { categoryId: string | null; categoryName: string; seconds: number }[];
    assert.equal(todayCats.length, 1);
    assert.equal(todayCats[0].categoryId, null);
    assert.equal(todayCats[0].categoryName, "未分类");
    assert.equal(todayCats[0].seconds, 3600);

    // range 统计：未分类桶 + rollup 下仍自成一组
    const statsRange = await t.app.inject({
      method: "GET",
      url: "/api/stats/range?tz=UTC&from=2026-08-31&to=2026-08-31&rollup=true",
      headers: cookieHeader(sid),
    });
    assert.equal(statsRange.statusCode, 200);
    const rangeCats = json(statsRange).categories as { categoryId: string | null; categoryName: string; seconds: number }[];
    assert.equal(rangeCats.length, 1);
    assert.equal(rangeCats[0].categoryId, null);
    assert.equal(rangeCats[0].categoryName, "未分类");
    assert.equal(rangeCats[0].seconds, 3600);
    assert.equal(json(statsRange).totalSeconds, 3600);
  });
});
