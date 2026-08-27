import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

describe("today clip and timezone", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("rejects missing or invalid tz", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tz_user");
    const missing = await t.app.inject({
      method: "GET",
      url: "/api/entries/today",
      headers: cookieHeader(sid),
    });
    assert.equal(missing.statusCode, 400);
    const bad = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=Not/AZone",
      headers: cookieHeader(sid),
    });
    assert.equal(bad.statusCode, 400);
  });

  it("clips a Shanghai overnight entry to today only", async () => {
    let now = new Date("2026-08-24T15:30:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "clipper");
    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const work = (json(catsRes).categories as { id: string; name: string }[]).find(
      (c) => c.name === "工作",
    );
    assert.ok(work);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id, description: "night" },
    });
    assert.equal(start.statusCode, 200);

    now = new Date("2026-08-24T17:00:00.000Z");
    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);

    now = new Date("2026-08-25T02:00:00.000Z");
    const stats = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    assert.equal(stats.statusCode, 200);
    const body = json(stats);
    assert.equal(body.dayStart, "2026-08-24T16:00:00.000Z");
    assert.equal(body.dayEnd, "2026-08-25T16:00:00.000Z");
    const rows = body.categories as { categoryName: string; seconds: number }[];
    const workRow = rows.find((r) => r.categoryName === "工作");
    assert.equal(workRow?.seconds, 3600);

    const list = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    const entries = json(list).entries as { clippedSeconds: number }[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].clippedSeconds, 3600);
  });

  it("sums two segments of one category and one of another", async () => {
    let now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "summer");
    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const cats = json(catsRes).categories as { id: string; name: string }[];
    const work = cats.find((c) => c.name === "工作");
    const study = cats.find((c) => c.name === "学习");
    assert.ok(work && study);

    now = new Date("2026-08-25T02:00:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    now = new Date("2026-08-25T02:10:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    now = new Date("2026-08-25T02:25:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: study.id },
    });
    now = new Date("2026-08-25T02:40:00.000Z");

    const stats = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    const rows = json(stats).categories as { categoryName: string; seconds: number }[];
    assert.equal(rows.find((r) => r.categoryName === "工作")?.seconds, 25 * 60);
    assert.equal(rows.find((r) => r.categoryName === "学习")?.seconds, 15 * 60);
  });

  it("today returns tags; stats filter by tagId; foreign tagId is 404", async () => {
    let now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "tag_stats");
    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const cats = json(catsRes).categories as { id: string; name: string }[];
    const work = cats.find((c) => c.name === "工作");
    const study = cats.find((c) => c.name === "学习");
    assert.ok(work && study);

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
      payload: { name: "会议" },
    });
    const tagAId = json(tagA).id as string;
    const tagBId = json(tagB).id as string;

    now = new Date("2026-08-25T02:00:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id, tagIds: [tagAId] },
    });
    now = new Date("2026-08-25T02:10:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: study.id, tagIds: [tagBId] },
    });
    now = new Date("2026-08-25T02:25:00.000Z");

    const list = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    const entries = json(list).entries as { id: string; tags: { id: string; name: string }[] }[];
    assert.equal(entries.length, 2);
    const withA = entries.find((e) => e.tags.some((x) => x.id === tagAId));
    const withB = entries.find((e) => e.tags.some((x) => x.id === tagBId));
    assert.ok(withA && withB);
    assert.equal(withA.tags.length, 1);
    assert.equal(withA.tags[0].name, "深度");

    const filtered = await t.app.inject({
      method: "GET",
      url: `/api/stats/today?tz=Asia/Shanghai&tagId=${tagAId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(filtered.statusCode, 200);
    const rows = json(filtered).categories as { categoryName: string; seconds: number }[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].categoryName, "工作");
    assert.equal(rows[0].seconds, 10 * 60);

    const foreign = await t.app.inject({
      method: "GET",
      url: `/api/stats/today?tz=Asia/Shanghai&tagId=${tagBId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(foreign.statusCode, 200);
    assert.equal((json(foreign).categories as unknown[]).length, 1);

    const missing = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=Asia/Shanghai&tagId=no-such-tag",
      headers: cookieHeader(sid),
    });
    assert.equal(missing.statusCode, 404);
  });

  it("running timer started yesterday only counts today's slice", async () => {
    let now = new Date("2026-08-24T15:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "runner");
    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const study = (json(catsRes).categories as { id: string; name: string }[]).find(
      (c) => c.name === "学习",
    );
    assert.ok(study);

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: study.id },
    });

    now = new Date("2026-08-25T02:00:00.000Z");
    const stats = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    const rows = json(stats).categories as { categoryName: string; seconds: number }[];
    const studyRow = rows.find((r) => r.categoryName === "学习");
    assert.equal(studyRow?.seconds, 10 * 3600);
  });

  it("date param anchors the day window (cross-midnight tz)", async () => {
    // 8月24日（周一）23:00–8月25日 01:00 +08:00 的一条跨午夜记录
    let now = new Date("2026-08-24T15:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "dater");
    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const work = (json(catsRes).categories as { id: string; name: string }[]).find(
      (c) => c.name === "工作",
    );
    assert.ok(work);

    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id, description: "overnight" },
    });
    now = new Date("2026-08-24T17:00:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });

    // 查看 8月24日：窗口为 +08:00 的 00:00–24:00，跨午夜条目只保留周一的 1 小时切片
    now = new Date("2026-08-30T02:00:00.000Z"); // 已到下周，date 仍应锚定 8月24日
    const res = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=Asia/Shanghai&date=2026-08-24",
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const body = json(res);
    assert.equal(body.dayStart, "2026-08-23T16:00:00.000Z");
    assert.equal(body.dayEnd, "2026-08-24T16:00:00.000Z");
    const entries = body.entries as { clippedSeconds: number; durationSeconds: number }[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].clippedSeconds, 3600);
    assert.equal(entries[0].durationSeconds, 7200); // 未裁剪全长

    // 未来日期也可用
    const future = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=Asia/Shanghai&date=2026-09-01",
      headers: cookieHeader(sid),
    });
    assert.equal(future.statusCode, 200);
    assert.equal((json(future).entries as unknown[]).length, 0);
  });

  it("rejects invalid date param with 400 VALIDATION", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "dater_bad");
    for (const url of [
      "/api/entries/today?tz=Asia/Shanghai&date=not-a-date",
      "/api/entries/today?tz=Asia/Shanghai&date=2025-02-30",
      "/api/entries/week?tz=Asia/Shanghai&date=not-a-date",
      "/api/entries/week?tz=Asia/Shanghai&date=2025-02-30",
    ]) {
      const res = await t.app.inject({ method: "GET", url, headers: cookieHeader(sid) });
      assert.equal(res.statusCode, 400, url);
      const err = json(res).error as { code: string };
      assert.equal(err.code, "VALIDATION", url);
    }
  });
});
