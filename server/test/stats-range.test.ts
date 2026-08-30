import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

async function getCategories(t: TestApp, sid: string) {
  const res = await t.app.inject({
    method: "GET",
    url: "/api/categories",
    headers: cookieHeader(sid),
  });
  return json(res).categories as { id: string; name: string; parentId: string | null }[];
}

async function createCategory(
  t: TestApp,
  sid: string,
  body: { name: string; parentId?: string | null },
) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/categories",
    headers: cookieHeader(sid),
    payload: body,
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
  return json(res) as { id: string; name: string; parentId: string | null };
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

  it("rollup=true merges child category seconds into parent; default keeps them separate", async () => {
    const now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_rollup");

    // 建 seed「学习」的子分类「英语」和「数学」
    const study = (await getCategories(t, sid)).find((c) => c.name === "学习");
    assert.ok(study);
    assert.equal(study.parentId, null);
    const english = await createCategory(t, sid, { name: "英语", parentId: study.id });
    const math = await createCategory(t, sid, { name: "数学", parentId: study.id });
    const work = (await getCategories(t, sid)).find((c) => c.name === "工作");
    assert.ok(work);

    // 周二 +08：英语 1h、数学 30m、学习（父级自身）15m、工作 45m
    await createEntry(t, sid, {
      categoryId: english.id,
      description: "english",
      tagIds: [],
      startedAt: "2026-08-24T16:00:00.000Z",
      stoppedAt: "2026-08-24T17:00:00.000Z",
    });
    await createEntry(t, sid, {
      categoryId: math.id,
      description: "math",
      tagIds: [],
      startedAt: "2026-08-24T17:00:00.000Z",
      stoppedAt: "2026-08-24T17:30:00.000Z",
    });
    await createEntry(t, sid, {
      categoryId: study.id,
      description: "study own",
      tagIds: [],
      startedAt: "2026-08-24T17:30:00.000Z",
      stoppedAt: "2026-08-24T17:45:00.000Z",
    });
    await createEntry(t, sid, {
      categoryId: work.id,
      description: "work",
      tagIds: [],
      startedAt: "2026-08-24T18:00:00.000Z",
      stoppedAt: "2026-08-24T18:45:00.000Z",
    });

    // 默认（独立模式）：四个分类各自出现（按秒数降序）
    const independent = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25");
    assert.ok(independent.body);
    assert.deepEqual(
      independent.body.categories.map((c) => [c.categoryName, c.seconds]),
      [
        ["英语", 3600],
        ["工作", 2700],
        ["数学", 1800],
        ["学习", 900],
      ],
    );
    assert.equal(independent.body.totalSeconds, 9000);

    // rollup=true：子分类秒数并入父分类，桶名用父分类名，子分类条目消失
    const rolled = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25&rollup=true");
    assert.ok(rolled.body);
    assert.deepEqual(
      rolled.body.categories.map((c) => [c.categoryId, c.categoryName, c.seconds]),
      [
        [study.id, "学习", 3600 + 1800 + 900],
        [work.id, "工作", 2700],
      ],
    );
    assert.equal(rolled.body.totalSeconds, 9000);
    // days / tags 不受 rollup 影响
    assert.deepEqual(rolled.body.days, [{ date: "2026-08-25", seconds: 9000 }]);

    // rollup=1 等价于 true
    const rolled1 = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25&rollup=1");
    assert.ok(rolled1.body);
    assert.equal(rolled1.body.categories.length, 2);

    // rollup=false 等同默认
    const explicit = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25&rollup=false");
    assert.ok(explicit.body);
    assert.equal(explicit.body.categories.length, 4);
  });

  it("rollup with parent that has no own entries still shows the parent bucket", async () => {
    const now = new Date("2026-08-25T02:00:00.000Z");
    t = await createTestApp({ now: () => now });
    const { sid } = await registerUser(t.app, "range_rollup_empty");

    // 父级「临时」自身无条目，只有子级有条目
    const parent = await createCategory(t, sid, { name: "临时" });
    const child = await createCategory(t, sid, { name: "杂项", parentId: parent.id });
    await createEntry(t, sid, {
      categoryId: child.id,
      description: "misc",
      tagIds: [],
      startedAt: "2026-08-24T16:00:00.000Z",
      stoppedAt: "2026-08-24T17:00:00.000Z",
    });

    const rolled = await getRange(t, sid, "tz=Asia/Shanghai&from=2026-08-25&to=2026-08-25&rollup=true");
    assert.ok(rolled.body);
    assert.deepEqual(
      rolled.body.categories.map((c) => [c.categoryId, c.categoryName, c.seconds]),
      [[parent.id, "临时", 3600]],
    );
    assert.equal(rolled.body.totalSeconds, 3600);
  });
});
