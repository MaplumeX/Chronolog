import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
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
