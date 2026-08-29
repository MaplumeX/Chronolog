import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

async function getCategories(t: TestApp, sid: string) {
  const res = await t.app.inject({
    method: "GET",
    url: "/api/categories",
    headers: cookieHeader(sid),
  });
  return json(res).categories as { id: string; name: string }[];
}

async function createTag(t: TestApp, sid: string, name: string) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/tags",
    headers: cookieHeader(sid),
    payload: { name },
  });
  return json(res).id as string;
}

async function createEntry(
  t: TestApp,
  sid: string,
  body: {
    categoryId: string;
    description: string;
    tagIds: string[];
    startedAt: string;
    stoppedAt: string;
  },
) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/entries",
    headers: cookieHeader(sid),
    payload: body,
  });
  assert.equal(res.statusCode, 201, JSON.stringify(res.json()));
}

type RangeBody = {
  tz: string;
  rangeStart: string;
  rangeEnd: string;
  days: { date: string; seconds: number }[];
  categories: { categoryId: string; categoryName: string; seconds: number }[];
  tags: { tagId: string | null; tagName: string | null; seconds: number }[];
  totalSeconds: number;
};

async function getRange(t: TestApp, sid: string, query: string) {
  const res = await t.app.inject({
    method: "GET",
    url: `/api/stats/range?${query}`,
    headers: cookieHeader(sid),
  });
  return { res, body: res.statusCode === 200 ? (json(res) as unknown as RangeBody) : null };
}

describe("stats range aggregation", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("rejects bad tz / missing or invalid dates / from > to / oversized range", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "range_bad");

    const cases: { url: string; status: number }[] = [
      // 缺 tz / 非法 tz
      { url: "/api/stats/range?from=2026-08-24&to=2026-08-26", status: 400 },
      { url: "/api/stats/range?tz=Not/AZone&from=2026-08-24&to=2026-08-26", status: 400 },
      // 缺 from / 缺 to
      { url: "/api/stats/range?tz=Asia/Shanghai&to=2026-08-26", status: 400 },
      { url: "/api/stats/range?tz=Asia/Shanghai&from=2026-08-24", status: 400 },
      // 无效日期（格式 / 滚溢出）
      { url: "/api/stats/range?tz=Asia/Shanghai&from=not-a-date&to=2026-08-26", status: 400 },
      { url: "/api/stats/range?tz=Asia/Shanghai&from=2026-08-24&to=2025-02-30", status: 400 },
      // from > to
      { url: "/api/stats/range?tz=Asia/Shanghai&from=2026-08-26&to=2026-08-24", status: 400 },
      // 超 92 天
      { url: "/api/stats/range?tz=Asia/Shanghai&from=2026-01-01&to=2026-04-03", status: 400 },
    ];
    for (const { url, status } of cases) {
      const res = await t.app.inject({ method: "GET", url, headers: cookieHeader(sid) });
      assert.equal(res.statusCode, status, url);
      const err = json(res).error as { code: string };
      assert.equal(err.code, "VALIDATION", url);
    }

    // 恰好 92 天（含端点）可通过
    const ok = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-01-01&to=2026-04-02");
    assert.equal(ok.res.statusCode, 200);
    assert.equal(ok.body?.days.length, 92);
  });

  it("splits an overnight Shanghai entry across days, pads zero days, sums categories", async () => {
    // 8月24日（周一）23:00 – 8月25日 01:00 +08 的一条跨午夜记录
    let now = new Date("2026-08-26T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_night");
    const cats = await getCategories(t, sid);
    const work = cats.find((c) => c.name === "工作");
    assert.ok(work);

    await createEntry(t, sid, {
      categoryId: work.id,
      description: "overnight",
      tagIds: [],
      startedAt: "2026-08-24T15:00:00.000Z",
      stoppedAt: "2026-08-24T17:00:00.000Z",
    });

    const { body } = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-24&to=2026-08-26");
    assert.ok(body);
    assert.equal(body.rangeStart, "2026-08-23T16:00:00.000Z");
    assert.equal(body.rangeEnd, "2026-08-26T16:00:00.000Z");
    // 3 天，含空白天补 0
    assert.deepEqual(
      body.days,
      [
        { date: "2026-08-24", seconds: 3600 },
        { date: "2026-08-25", seconds: 3600 },
        { date: "2026-08-26", seconds: 0 },
      ],
    );
    // range 级分类聚合 = 总时长
    assert.equal(body.categories.length, 1);
    assert.equal(body.categories[0].categoryName, "工作");
    assert.equal(body.categories[0].seconds, 7200);
    assert.equal(body.totalSeconds, 7200);
    // 无标签桶
    assert.equal(body.tags.length, 1);
    assert.equal(body.tags[0].tagId, null);
    assert.equal(body.tags[0].seconds, 7200);
  });

  it("clips a running entry by now across two days", async () => {
    let now = new Date("2026-08-24T15:00:00.000Z"); // 周一 23:00 +08
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_runner");
    const cats = await getCategories(t, sid);
    const study = cats.find((c) => c.name === "学习");
    assert.ok(study);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: study.id },
    });
    assert.equal(start.statusCode, 200);

    now = new Date("2026-08-25T02:00:00.000Z"); // 周二 10:00 +08
    const { body } = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-24&to=2026-08-25");
    assert.ok(body);
    assert.deepEqual(
      body.days,
      [
        { date: "2026-08-24", seconds: 3600 }, // 周一 23:00–24:00
        { date: "2026-08-25", seconds: 10 * 3600 }, // 周二 00:00–10:00（按 now 裁剪）
      ],
    );
    assert.equal(body.totalSeconds, 11 * 3600);
  });

  it("counts multi-tag entries under each tag and keeps a no-tag bucket", async () => {
    const now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_tags");
    const cats = await getCategories(t, sid);
    const work = cats.find((c) => c.name === "工作");
    const study = cats.find((c) => c.name === "学习");
    assert.ok(work && study);

    const tagA = await createTag(t, sid, "深度");
    const tagB = await createTag(t, sid, "会议");

    // 周二 00:30–01:30 +08，双标签
    await createEntry(t, sid, {
      categoryId: work.id,
      description: "dual",
      tagIds: [tagA, tagB],
      startedAt: "2026-08-24T16:30:00.000Z",
      stoppedAt: "2026-08-24T17:30:00.000Z",
    });
    // 周二 02:00–02:10 +08，无标签
    await createEntry(t, sid, {
      categoryId: study.id,
      description: "untagged",
      tagIds: [],
      startedAt: "2026-08-24T18:00:00.000Z",
      stoppedAt: "2026-08-24T18:10:00.000Z",
    });

    const { body } = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25");
    assert.ok(body);
    // 多标签条目在每个标签下计入全额秒数（tags 总和可大于 totalSeconds）
    const aRow = body.tags.find((r) => r.tagId === tagA);
    const bRow = body.tags.find((r) => r.tagId === tagB);
    const noneRow = body.tags.find((r) => r.tagId === null);
    assert.equal(aRow?.tagName, "深度");
    assert.equal(aRow?.seconds, 3600);
    assert.equal(bRow?.seconds, 3600);
    assert.equal(noneRow?.tagName, null);
    assert.equal(noneRow?.seconds, 600);
    // 分类与总和
    assert.equal(body.totalSeconds, 4200);
    assert.deepEqual(
      body.categories.map((c) => [c.categoryName, c.seconds]),
      [
        ["工作", 3600],
        ["学习", 600],
      ],
    );
    // days 联动
    assert.deepEqual(body.days, [{ date: "2026-08-25", seconds: 4200 }]);

    // tagId 筛选：只统计带 tagA 的条目
    const filtered = await getRange(t, sid, `tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25&tagId=${tagA}`);
    assert.ok(filtered.body);
    assert.equal(filtered.body.totalSeconds, 3600);
    assert.equal(filtered.body.tags.find((r) => r.tagId === null)?.seconds, undefined);
    assert.equal(filtered.body.tags.find((r) => r.tagId === tagA)?.seconds, 3600);
  });

  it("returns 404 for a foreign tagId", async () => {
    const now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_owner");
    const other = await registerUser(t.app, "range_other");
    const foreignTagId = await createTag(t, other.sid, "别人的标签");

    const { res } = await getRange(
      t,
      sid,
      `tz=Asia/Shanghai&from=2026-08-24&to=2026-08-26&tagId=${foreignTagId}`,
    );
    assert.equal(res.statusCode, 404);
    assert.equal((json(res).error as { code: string }).code, "NOT_FOUND");
  });

  it("empty range returns zero-filled days and empty aggregates", async () => {
    const now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_empty");

    const { body } = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-24&to=2026-08-26");
    assert.ok(body);
    assert.equal(body.days.length, 3);
    assert.ok(body.days.every((d) => d.seconds === 0));
    assert.deepEqual(body.categories, []);
    assert.deepEqual(body.tags, []);
    assert.equal(body.totalSeconds, 0);
  });
});
