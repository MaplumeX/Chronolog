import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

describe("user isolation", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("user A cannot see user B categories, entries, or running timer", async () => {
    t = await createTestApp();
    const a = await registerUser(t.app, "alice_iso");
    const b = await registerUser(t.app, "bob_iso");

    const created = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(a.sid),
      payload: { name: "秘密" },
    });
    assert.equal(created.statusCode, 200);
    const secretId = json(created).id as string;

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(a.sid),
      payload: { categoryId: secretId, description: "only alice" },
    });
    assert.equal(start.statusCode, 200);

    const bCats = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(b.sid),
    });
    const names = (json(bCats).categories as { name: string }[]).map((c) => c.name);
    assert.equal(names.includes("秘密"), false);

    const bCurrent = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(b.sid),
    });
    assert.equal(json(bCurrent).entry, null);

    const bToday = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=Asia/Shanghai",
      headers: cookieHeader(b.sid),
    });
    assert.equal((json(bToday).entries as unknown[]).length, 0);

    const steal = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${secretId}`,
      headers: cookieHeader(b.sid),
    });
    assert.equal(steal.statusCode, 404);

    const stealStart = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(b.sid),
      payload: { categoryId: secretId },
    });
    assert.equal(stealStart.statusCode, 404);

    const stealPatch = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${secretId}`,
      headers: cookieHeader(b.sid),
      payload: { name: "偷走" },
    });
    assert.equal(stealPatch.statusCode, 404);
  });
});
