import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

type Clock = { value: Date };

const BASE = "2026-08-25T02:00:00.000Z"; // 上海 8月25日 10:00

describe("entries/boundary", () => {
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

  /** 用 start/stop 创建一条 [startIso, stopIso] 的已停止条目。 */
  async function createStopped(
    sid: string,
    categoryId: string,
    c: Clock,
    startIso: string,
    stopIso: string,
  ) {
    c.value = new Date(startIso);
    const startRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId },
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

  async function boundary(sid: string, start: string, end: string, tz = "Asia/Shanghai") {
    const res = await t.app.inject({
      method: "GET",
      url: `/api/entries/boundary?tz=${encodeURIComponent(tz)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      headers: cookieHeader(sid),
    });
    return { status: res.statusCode, body: json(res) };
  }

  function entryOf(res: { status: number; body: Record<string, unknown> }, key: "prevEntry" | "nextEntry") {
    return res.body[key] as
      | { id: string; startedAt: string; stoppedAt: string | null; tags: { id: string; name: string }[] }
      | null;
  }

  it("requires auth", async () => {
    t = await createTestApp();
    const res = await t.app.inject({
      method: "GET",
      url: `/api/entries/boundary?tz=Asia/Shanghai&start=${BASE}&end=2026-08-25T16:00:00.000Z`,
    });
    assert.equal(res.statusCode, 401);
  });

  it("rejects missing/invalid tz, invalid datetime, and start >= end", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "boundary_bad");
    const cases: { url: string; status: number }[] = [
      // 缺 tz
      {
        url: `/api/entries/boundary?start=${BASE}&end=2026-08-25T16:00:00.000Z`,
        status: 400,
      },
      // 非法 tz
      {
        url: `/api/entries/boundary?tz=Not/AZone&start=${BASE}&end=2026-08-25T16:00:00.000Z`,
        status: 400,
      },
      // 非法 datetime
      {
        url: `/api/entries/boundary?tz=Asia/Shanghai&start=not-a-time&end=2026-08-25T16:00:00.000Z`,
        status: 400,
      },
      // start == end
      {
        url: `/api/entries/boundary?tz=Asia/Shanghai&start=${BASE}&end=${BASE}`,
        status: 400,
      },
      // start > end
      {
        url: `/api/entries/boundary?tz=Asia/Shanghai&start=2026-08-25T16:00:00.000Z&end=${BASE}`,
        status: 400,
      },
    ];
    for (const { url, status } of cases) {
      const res = await t.app.inject({ method: "GET", url, headers: cookieHeader(sid) });
      assert.equal(res.statusCode, status, url);
      const err = json(res).error as { code: string };
      assert.equal(err.code, "VALIDATION", url);
    }
  });

  it("returns closest prev and next entries; ignores in-window entries", async () => {
    const c: Clock = { value: new Date(BASE) };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "boundary_basic");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);

    // 窗口 [08:00, 16:00Z]（上海 16:00–24:00）
    const start = "2026-08-25T08:00:00.000Z";
    const end = "2026-08-25T16:00:00.000Z";
    // 三个更早条目，最晚结束的是 07:30 那条
    await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z");
    const prevId = await createStopped(
      sid,
      work.id,
      c,
      "2026-08-25T02:00:00.000Z",
      "2026-08-25T07:30:00.000Z",
    );
    // 窗口内条目：不应被返回
    await createStopped(sid, work.id, c, "2026-08-25T10:00:00.000Z", "2026-08-25T11:00:00.000Z");
    // 两个更晚条目，最早开始的是 17:00 那条
    const nextId = await createStopped(
      sid,
      work.id,
      c,
      "2026-08-25T17:00:00.000Z",
      "2026-08-25T18:00:00.000Z",
    );
    await createStopped(sid, work.id, c, "2026-08-26T01:00:00.000Z", "2026-08-26T02:00:00.000Z");

    const res = await boundary(sid, start, end);
    assert.equal(res.status, 200);
    assert.equal(res.body.tz, "Asia/Shanghai");
    const prev = entryOf(res, "prevEntry");
    const next = entryOf(res, "nextEntry");
    assert.ok(prev);
    assert.equal(prev.id, prevId);
    assert.equal(prev.stoppedAt, "2026-08-25T07:30:00.000Z");
    assert.ok(next);
    assert.equal(next.id, nextId);
    assert.equal(next.startedAt, "2026-08-25T17:00:00.000Z");
  });

  it("running entry as prev (stoppedAt null) has infinite right edge", async () => {
    const c: Clock = { value: new Date(BASE) };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "boundary_running");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);

    // 更早的已停止条目
    await createStopped(sid, work.id, c, "2026-08-25T01:00:00.000Z", "2026-08-25T02:00:00.000Z");
    // running 条目开始于窗口前
    c.value = new Date("2026-08-25T07:00:00.000Z");
    const runningRes = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(runningRes.statusCode, 200);
    const runningId = (json(runningRes).entry as { id: string }).id;

    const res = await boundary(sid, "2026-08-25T08:00:00.000Z", "2026-08-25T16:00:00.000Z");
    assert.equal(res.status, 200);
    const prev = entryOf(res, "prevEntry");
    assert.ok(prev);
    assert.equal(prev.id, runningId);
    assert.equal(prev.stoppedAt, null);
    assert.equal(res.body.nextEntry, null);
  });

  it("touching boundary (stoppedAt == start) counts as prev", async () => {
    const c: Clock = { value: new Date(BASE) };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "boundary_touch");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    assert.ok(work);

    const prevId = await createStopped(
      sid,
      work.id,
      c,
      "2026-08-25T01:00:00.000Z",
      "2026-08-25T08:00:00.000Z",
    );

    const res = await boundary(sid, "2026-08-25T08:00:00.000Z", "2026-08-25T16:00:00.000Z");
    assert.equal(res.status, 200);
    const prev = entryOf(res, "prevEntry");
    assert.ok(prev);
    assert.equal(prev.id, prevId);
  });

  it("returns both null when no entries exist near the window", async () => {
    const c: Clock = { value: new Date(BASE) };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "boundary_empty");

    const res = await boundary(sid, "2026-08-25T08:00:00.000Z", "2026-08-25T16:00:00.000Z");
    assert.equal(res.status, 200);
    assert.equal(res.body.prevEntry, null);
    assert.equal(res.body.nextEntry, null);
  });

  it("keeps entries of other users out", async () => {
    const c: Clock = { value: new Date(BASE) };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "boundary_mine");
    const other = await registerUser(t.app, "boundary_other");
    const cats = await categories(sid);
    const work = cats.find((x) => x.name === "工作");
    const otherCats = await categories(other.sid);
    const otherWork = otherCats.find((x) => x.name === "工作");
    assert.ok(work && otherWork);

    await createStopped(
      other.sid,
      otherWork.id,
      c,
      "2026-08-25T01:00:00.000Z",
      "2026-08-25T02:00:00.000Z",
    );

    const res = await boundary(sid, "2026-08-25T08:00:00.000Z", "2026-08-25T16:00:00.000Z");
    assert.equal(res.status, 200);
    assert.equal(res.body.prevEntry, null);
    assert.equal(res.body.nextEntry, null);
  });
});
