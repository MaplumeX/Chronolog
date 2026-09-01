import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import { createTestApp, registerUser, cookieHeader, json, type TestApp } from "./helpers.js";

/** 归档分类的时间记录仍计入统计（PRD：统计不排除归档分类）。 */
describe("archived categories still count in stats", () => {
  let t: TestApp | undefined;
  afterEach(async () => {
    await t?.close();
    t = undefined;
  });

  it("stats include entries of archived categories", async () => {
    const clock = { v: new Date("2026-08-31T04:00:00.000Z") };
    t = await createTestApp({ now: () => clock.v });
    const { sid } = await registerUser(t.app, "arch_stats");
    const cats = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const list = json(cats).categories as { id: string; name: string }[];
    const work = list.find((c) => c.name === "工作")!;
    const started = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(started.statusCode, 200);
    clock.v = new Date("2026-08-31T05:00:00.000Z");
    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);
    const archive = await t.app.inject({
      method: "POST",
      url: `/api/categories/${work.id}/archive`,
      headers: cookieHeader(sid),
    });
    assert.equal(archive.statusCode, 200);
    const stats = await t.app.inject({
      method: "GET",
      url: "/api/stats/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal(stats.statusCode, 200);
    const catsOut = json(stats).categories as {
      categoryId: string | null;
      categoryName: string;
      seconds: number;
    }[];
    const bucket = catsOut.find((c) => c.categoryName === "工作");
    assert.ok(bucket, "归档分类的条目仍应计入统计");
    assert.equal(bucket.seconds, 3600);
  });
});
