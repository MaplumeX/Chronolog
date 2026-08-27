import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

describe("week entries", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("rejects missing or invalid tz", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "week_tz");
    const missing = await t.app.inject({
      method: "GET",
      url: "/api/entries/week",
      headers: cookieHeader(sid),
    });
    assert.equal(missing.statusCode, 400);
    const bad = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=Not/AZone",
      headers: cookieHeader(sid),
    });
    assert.equal(bad.statusCode, 400);
  });

  it("returns 7 days from Monday 00:00 in the caller's zone", async () => {
    const now = new Date("2026-08-25T02:00:00.000Z"); // 周二 Asia/Shanghai
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "week_bounds");

    const res = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const body = json(res);
    assert.equal(body.weekStart, "2026-08-23T16:00:00.000Z"); // 周一 00:00 +08:00
    assert.equal(body.weekEnd, "2026-08-30T16:00:00.000Z"); // 周日 24:00 +08:00
    const days = body.days as { dayStart: string; dayEnd: string }[];
    assert.equal(days.length, 7);
    assert.equal(days[0].dayStart, "2026-08-23T16:00:00.000Z");
    assert.equal(days[0].dayEnd, "2026-08-24T16:00:00.000Z");
    assert.equal(days[6].dayStart, "2026-08-29T16:00:00.000Z");
    assert.equal(days[6].dayEnd, "2026-08-30T16:00:00.000Z");
  });

  it("splits an overnight entry across two days, clipping per day", async () => {
    let now = new Date("2026-08-24T15:00:00.000Z"); // 周一 23:00 +08:00
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "week_clip");
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
      payload: { categoryId: work.id, description: "overnight" },
    });
    assert.equal(start.statusCode, 200);

    now = new Date("2026-08-24T17:00:00.000Z"); // 周二 01:00 +08:00
    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);

    now = new Date("2026-08-25T02:00:00.000Z");
    const res = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const days = json(res).days as {
      dayStart: string;
      entries: { description: string; clippedSeconds: number; durationSeconds: number }[];
    }[];
    const monday = days[0];
    const tuesday = days[1];
    assert.equal(monday.entries.length, 1);
    assert.equal(monday.entries[0].clippedSeconds, 3600); // 23:00–24:00
    assert.equal(tuesday.entries.length, 1);
    assert.equal(tuesday.entries[0].clippedSeconds, 3600); // 00:00–01:00
    assert.equal(tuesday.entries[0].durationSeconds, 7200); // 未裁剪全长
    // 其余天无记录
    for (let i = 2; i < 7; i++) {
      assert.equal((days[i].entries as unknown[]).length, 0);
    }
  });

  it("counts a running entry in the current day column", async () => {
    let now = new Date("2026-08-25T02:00:00.000Z"); // 周二 10:00 +08:00
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "week_run");
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

    now = new Date("2026-08-25T04:00:00.000Z"); // 周二 12:00 +08:00
    const res = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=Asia/Shanghai",
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const days = json(res).days as {
      entries: { stoppedAt: string | null; clippedSeconds: number }[];
    }[];
    const tuesday = days[1];
    assert.equal(tuesday.entries.length, 1);
    assert.equal(tuesday.entries[0].stoppedAt, null);
    assert.equal(tuesday.entries[0].clippedSeconds, 2 * 3600);
    for (let i = 0; i < 7; i++) {
      if (i === 1) continue;
      assert.equal((days[i].entries as unknown[]).length, 0);
    }
  });

  it("keeps day windows aligned to local midnights across a midnight DST shift", async () => {
    // America/Santiago 2026-09-06 周日 00:00 拨快 1 小时：周日列窗口必须仍为本地 00:00–24:00
    const now = new Date("2026-08-31T12:00:00.000Z"); // 周一
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "week_dst");

    const res = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=America/Santiago",
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const body = json(res);
    assert.equal(body.weekStart, "2026-08-31T04:00:00.000Z"); // 周一 00:00 -04:00
    assert.equal(body.weekEnd, "2026-09-07T03:00:00.000Z"); // 周日 24:00 -03:00
    const days = body.days as { dayStart: string; dayEnd: string }[];
    assert.equal(days[6].dayStart, "2026-09-06T04:00:00.000Z"); // 周日 00:00 -04:00
    assert.equal(days[6].dayEnd, "2026-09-07T03:00:00.000Z"); // 周日 24:00 -03:00，与 weekEnd 一致
  });

  it("isolates users: bob sees an empty week", async () => {
    t = await createTestApp();
    const a = await registerUser(t.app, "alice_week");
    const b = await registerUser(t.app, "bob_week");
    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(a.sid),
    });
    const work = (json(catsRes).categories as { id: string; name: string }[]).find(
      (c) => c.name === "工作",
    );
    assert.ok(work);
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(a.sid),
      payload: { categoryId: work.id },
    });

    const bRes = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=Asia/Shanghai",
      headers: cookieHeader(b.sid),
    });
    assert.equal(bRes.statusCode, 200);
    const days = json(bRes).days as { entries: unknown[] }[];
    assert.equal(days.length, 7);
    for (const day of days) assert.equal(day.entries.length, 0);
  });

  it("date param anchors the week window, any day of the week", async () => {
    // 周一 23:00 +08:00 开始的一条 2 小时跨午夜记录（周一 1h + 周二 1h）
    let now = new Date("2026-08-24T15:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "week_dater");
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
      payload: { categoryId: work.id },
    });
    now = new Date("2026-08-24T17:00:00.000Z");
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });

    // 8月24日是周一、8月26日是周三、8月30日是周日；date 锚定到其所在周的同一周
    now = new Date("2026-08-30T02:00:00.000Z"); // 已到下周
    for (const date of ["2026-08-24", "2026-08-26", "2026-08-30"]) {
      const res = await t.app.inject({
        method: "GET",
        url: `/api/entries/week?tz=Asia/Shanghai&date=${date}`,
        headers: cookieHeader(sid),
      });
      assert.equal(res.statusCode, 200);
      const body = json(res);
      assert.equal(body.weekStart, "2026-08-23T16:00:00.000Z");
      assert.equal(body.weekEnd, "2026-08-30T16:00:00.000Z");
      const days = body.days as { entries: { clippedSeconds: number }[] }[];
      assert.equal(days.length, 7);
      assert.equal(days[0].entries.length, 1);
      assert.equal(days[0].entries[0].clippedSeconds, 3600);
      assert.equal(days[1].entries.length, 1);
      assert.equal(days[1].entries[0].clippedSeconds, 3600);
    }
  });

  it("date param keeps day windows aligned to local midnights across a midnight DST shift", async () => {
    // America/Santiago 2026-09-06 周日 00:00 拨快：date 锚定的周的周日列窗口仍为本地 00:00–24:00
    const now = new Date("2026-08-31T12:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "week_dst_date");

    const res = await t.app.inject({
      method: "GET",
      url: "/api/entries/week?tz=America/Santiago&date=2026-09-03",
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const body = json(res);
    assert.equal(body.weekStart, "2026-08-31T04:00:00.000Z");
    assert.equal(body.weekEnd, "2026-09-07T03:00:00.000Z");
    const days = body.days as { dayStart: string; dayEnd: string }[];
    assert.equal(days[6].dayStart, "2026-09-06T04:00:00.000Z");
    assert.equal(days[6].dayEnd, "2026-09-07T03:00:00.000Z");
  });
});
