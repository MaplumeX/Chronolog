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
