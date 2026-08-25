import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, sidOf, type TestApp } from "./helpers.js";

describe("auth", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("rejects short username, short password, and duplicate username", async () => {
    t = await createTestApp();
    const shortUser = await t.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "ab", password: "password1" },
    });
    assert.equal(shortUser.statusCode, 400);

    const shortPass = await t.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "alice", password: "short" },
    });
    assert.equal(shortPass.statusCode, 400);

    const first = await registerUser(t.app, "alice");
    assert.equal(first.res.statusCode, 200);

    const dup = await t.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "Alice", password: "password1" },
    });
    assert.equal(dup.statusCode, 409);
  });

  it("logs in with the same credentials and stays logged in", async () => {
    t = await createTestApp();
    await registerUser(t.app, "bob");

    const login = await t.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "bob", password: "password1" },
    });
    assert.equal(login.statusCode, 200);
    const cookie = login.cookies.find((c) => c.name === "sid");
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.path, "/");
    assert.equal(String(cookie.sameSite).toLowerCase(), "lax");
    assert.notEqual(cookie.secure, true);
    const sid = cookie.value;

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid),
    });
    assert.equal(me.statusCode, 200);
    assert.equal(json(me).username, "bob");
  });

  it("login replaces the previous session id", async () => {
    t = await createTestApp();
    const first = await registerUser(t.app, "erin");
    const login = await t.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "erin", password: "password1" },
      headers: cookieHeader(first.sid),
    });
    assert.equal(login.statusCode, 200);
    const sid2 = sidOf(login);
    assert.notEqual(sid2, first.sid);

    const oldMe = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(first.sid),
    });
    assert.equal(oldMe.statusCode, 401);

    const newMe = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid2),
    });
    assert.equal(newMe.statusCode, 200);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    t = await createTestApp();
    const calls = [
      { method: "GET" as const, url: "/api/auth/me" },
      { method: "GET" as const, url: "/api/categories" },
      { method: "GET" as const, url: "/api/timer/current" },
      { method: "POST" as const, url: "/api/timer/start", payload: { categoryId: "x" } },
      { method: "POST" as const, url: "/api/timer/stop" },
      { method: "GET" as const, url: "/api/entries/today?tz=Asia/Shanghai" },
      { method: "GET" as const, url: "/api/stats/today?tz=Asia/Shanghai" },
    ];
    for (const call of calls) {
      const res = await t.app.inject(call);
      assert.equal(res.statusCode, 401, call.url);
      assert.equal((json(res).error as { code: string }).code, "UNAUTHORIZED");
    }
  });

  it("logout deletes the session so later requests are 401", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "carol");

    const logout = await t.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: cookieHeader(sid),
    });
    assert.equal(logout.statusCode, 200);

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid),
    });
    assert.equal(me.statusCode, 401);

    const cats = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    assert.equal(cats.statusCode, 401);
  });

  it("seeds default categories on register", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "dana");
    const res = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const names = (json(res).categories as { name: string }[]).map((c) => c.name);
    assert.deepEqual(names.sort(), ["事务", "休息", "学习", "工作"].sort());
  });
});
