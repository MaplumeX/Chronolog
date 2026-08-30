import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

describe("categories", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("creates and renames; rejects empty or duplicate names", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_user");

    const empty = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "   " },
    });
    assert.equal(empty.statusCode, 400);

    const created = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "阅读" },
    });
    assert.equal(created.statusCode, 200);
    const id = json(created).id as string;

    const dup = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "阅读" },
    });
    assert.equal(dup.statusCode, 409);

    const rename = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${id}`,
      headers: cookieHeader(sid),
      payload: { name: "深度阅读" },
    });
    assert.equal(rename.statusCode, 200);
    assert.equal(json(rename).name, "深度阅读");
  });

  it("color: create/list/patch round-trip; invalid values are rejected", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_color");

    const created = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "阅读", color: 3 },
    });
    assert.equal(created.statusCode, 200);
    const id = json(created).id as string;
    assert.equal(json(created).color, 3);

    const list = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    assert.equal(list.statusCode, 200);
    const found = (json(list).categories as { id: string; color: number | null }[]).find(
      (c) => c.id === id,
    );
    assert.ok(found);
    assert.equal(found.color, 3);

    const defaultCreated = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "默认" },
    });
    assert.equal(defaultCreated.statusCode, 200);
    assert.equal(json(defaultCreated).color, null);

    const setColor = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${id}`,
      headers: cookieHeader(sid),
      payload: { color: 8 },
    });
    assert.equal(setColor.statusCode, 200);
    assert.equal(json(setColor).color, 8);
    assert.equal(json(setColor).name, "阅读");

    const setBoth = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${id}`,
      headers: cookieHeader(sid),
      payload: { name: "泛读", color: 1 },
    });
    assert.equal(setBoth.statusCode, 200);
    assert.equal(json(setBoth).name, "泛读");
    assert.equal(json(setBoth).color, 1);

    const clearColor = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${id}`,
      headers: cookieHeader(sid),
      payload: { color: null },
    });
    assert.equal(clearColor.statusCode, 200);
    assert.equal(json(clearColor).color, null);
    assert.equal(json(clearColor).name, "泛读");

    const after = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const afterFound = (json(after).categories as { id: string; color: number | null }[]).find(
      (c) => c.id === id,
    );
    assert.ok(afterFound);
    assert.equal(afterFound.color, null);

    for (const invalid of [0, 9, -1]) {
      const badPost = await t.app.inject({
        method: "POST",
        url: "/api/categories",
        headers: cookieHeader(sid),
        payload: { name: `坏${invalid}`, color: invalid },
      });
      assert.equal(badPost.statusCode, 400);
      assert.equal((json(badPost).error as { code: string }).code, "VALIDATION");

      const badPatch = await t.app.inject({
        method: "PATCH",
        url: `/api/categories/${id}`,
        headers: cookieHeader(sid),
        payload: { color: invalid },
      });
      assert.equal(badPatch.statusCode, 400);
      assert.equal((json(badPatch).error as { code: string }).code, "VALIDATION");
    }

    for (const invalid of ["red", 1.5]) {
      const badPost = await t.app.inject({
        method: "POST",
        url: "/api/categories",
        headers: cookieHeader(sid),
        payload: { name: `坏${invalid}`, color: invalid },
      });
      assert.equal(badPost.statusCode, 400);
      assert.equal((json(badPost).error as { code: string }).code, "VALIDATION");

      const badPatch = await t.app.inject({
        method: "PATCH",
        url: `/api/categories/${id}`,
        headers: cookieHeader(sid),
        payload: { color: invalid },
      });
      assert.equal(badPatch.statusCode, 400);
      assert.equal((json(badPatch).error as { code: string }).code, "VALIDATION");
    }

    const emptyPatch = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${id}`,
      headers: cookieHeader(sid),
      payload: {},
    });
    assert.equal(emptyPatch.statusCode, 400);
    assert.equal((json(emptyPatch).error as { code: string }).code, "VALIDATION");
  });

  it("cannot delete a category that is in use; unused can be deleted", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_del");
    const list = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const work = (json(list).categories as { id: string; name: string }[]).find(
      (c) => c.name === "工作",
    );
    assert.ok(work);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id },
    });
    assert.equal(start.statusCode, 200);
    const stop = await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    assert.equal(stop.statusCode, 200);

    const occupied = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${work.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(occupied.statusCode, 409);

    const extra = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "临时" },
    });
    const extraId = json(extra).id as string;
    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${extraId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);
  });

  it("running timer also occupies the category", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_run");
    const list = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const rest = (json(list).categories as { id: string; name: string }[]).find(
      (c) => c.name === "休息",
    );
    assert.ok(rest);
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: rest.id },
    });
    const occupied = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${rest.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(occupied.statusCode, 409);
  });

  it("category referenced by a goal cannot be deleted; unreferenced still can", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_goal_ref");
    const list = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const study = (json(list).categories as { id: string; name: string }[]).find(
      (c) => c.name === "学习",
    );
    assert.ok(study);

    const goal = await t.app.inject({
      method: "POST",
      url: "/api/goals",
      headers: cookieHeader(sid),
      payload: {
        name: "每日学习",
        direction: "gt",
        hours: 1,
        periodUnit: "day",
        categoryId: study.id,
      },
    });
    assert.equal(goal.statusCode, 200);

    const occupied = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${study.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(occupied.statusCode, 409);
    assert.equal((json(occupied).error as { code: string }).code, "CONFLICT");

    const extra = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "临时" },
    });
    const extraId = json(extra).id as string;
    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${extraId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);
  });
});
