import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  cookieHeader,
  createTestApp,
  json,
  registerUser,
  sidOf,
  type TestApp,
} from "./helpers.js";

function bearerHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

function errorCode(res: { statusCode: number }) {
  return res.statusCode >= 400 ? (json(res as never).error as { code: string }).code : undefined;
}

async function createToken(app: TestApp["app"], sid: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/tokens",
    payload: { name: "cli" },
    headers: cookieHeader(sid),
  });
  assert.equal(res.statusCode, 200);
  return (json(res) as { token: string }).token;
}

describe("account: profile", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("updates the username and reflects it in me", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");

    const res = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { username: "alice_2" },
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(json(res), { id: json(res).id, username: "alice_2", displayName: null });

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid),
    });
    assert.equal(me.statusCode, 200);
    assert.equal((json(me) as { username: string }).username, "alice_2");
  });

  it("updates displayName with trimming and clears it with an empty string", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");

    const set = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { displayName: "  爱丽丝  " },
      headers: cookieHeader(sid),
    });
    assert.equal(set.statusCode, 200);
    assert.equal((json(set) as { displayName: string | null }).displayName, "爱丽丝");

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid),
    });
    assert.equal((json(me) as { displayName: string | null }).displayName, "爱丽丝");

    const clear = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { displayName: "" },
      headers: cookieHeader(sid),
    });
    assert.equal(clear.statusCode, 200);
    assert.equal((json(clear) as { displayName: string | null }).displayName, null);
  });

  it("returns 409 when the new username is taken (NOCASE)", async () => {
    t = await createTestApp();
    await registerUser(t.app, "alice");
    const bob = await registerUser(t.app, "bob");

    const res = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { username: "Alice" },
      headers: cookieHeader(bob.sid),
    });
    assert.equal(res.statusCode, 409);
    assert.equal(errorCode(res), "CONFLICT");
  });

  it("validates username, displayName length, and empty updates", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");

    const badUsername = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { username: "a!" },
      headers: cookieHeader(sid),
    });
    assert.equal(badUsername.statusCode, 400);
    assert.equal(errorCode(badUsername), "VALIDATION");

    const longDisplayName = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { displayName: "x".repeat(33) },
      headers: cookieHeader(sid),
    });
    assert.equal(longDisplayName.statusCode, 400);
    assert.equal(errorCode(longDisplayName), "VALIDATION");

    const empty = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: {},
      headers: cookieHeader(sid),
    });
    assert.equal(empty.statusCode, 400);
    assert.equal(errorCode(empty), "VALIDATION");

    const unauth = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { username: "newname" },
    });
    assert.equal(unauth.statusCode, 401);
    assert.equal(errorCode(unauth), "UNAUTHORIZED");
  });

  it("lets a Bearer PAT update the profile", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");
    const token = await createToken(t.app, sid);

    const res = await t.app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { displayName: "  Alice  " },
      headers: bearerHeader(token),
    });
    assert.equal(res.statusCode, 200);
    assert.equal((json(res) as { displayName: string }).displayName, "Alice");
  });
});

describe("account: password", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("rejects a wrong current password with 401", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");

    const res = await t.app.inject({
      method: "PATCH",
      url: "/api/account/password",
      payload: { currentPassword: "wrong-pass", newPassword: "newpassword1" },
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 401);
    assert.equal(errorCode(res), "UNAUTHORIZED");
  });

  it("changes the password, keeps the current session, and revokes other sessions", async () => {
    t = await createTestApp();
    const register = await registerUser(t.app, "alice");
    const secondLogin = await t.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "password1" },
    });
    const sid2 = sidOf(secondLogin);
    assert.notEqual(sid2, register.sid);

    const change = await t.app.inject({
      method: "PATCH",
      url: "/api/account/password",
      payload: { currentPassword: "password1", newPassword: "newpassword1" },
      headers: cookieHeader(register.sid),
    });
    assert.equal(change.statusCode, 200);

    const newLogin = await t.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "newpassword1" },
    });
    assert.equal(newLogin.statusCode, 200);

    const oldPasswordLogin = await t.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "password1" },
    });
    assert.equal(oldPasswordLogin.statusCode, 401);
    assert.equal(errorCode(oldPasswordLogin), "UNAUTHORIZED");

    const otherSession = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid2),
    });
    assert.equal(otherSession.statusCode, 401);

    const currentSession = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(register.sid),
    });
    assert.equal(currentSession.statusCode, 200);
    assert.equal((json(currentSession) as { username: string }).username, "alice");
  });

  it("lets a Bearer PAT change the password and keeps working afterwards", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");
    const token = await createToken(t.app, sid);

    const change = await t.app.inject({
      method: "PATCH",
      url: "/api/account/password",
      payload: { currentPassword: "password1", newPassword: "newpassword1" },
      headers: bearerHeader(token),
    });
    assert.equal(change.statusCode, 200);

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearerHeader(token),
    });
    assert.equal(me.statusCode, 200);
    assert.equal((json(me) as { username: string }).username, "alice");

    const login = await t.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "alice", password: "newpassword1" },
    });
    assert.equal(login.statusCode, 200);
  });
});

describe("account: deletion", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("rejects a wrong confirmation password with 401", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");

    const res = await t.app.inject({
      method: "DELETE",
      url: "/api/account",
      payload: { password: "wrong-pass" },
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 401);
    assert.equal(errorCode(res), "UNAUTHORIZED");
  });

  it("deletes the account, cascades data, invalidates sessions and PATs", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");
    const token = await createToken(t.app, sid);

    const del = await t.app.inject({
      method: "DELETE",
      url: "/api/account",
      payload: { password: "password1" },
      headers: cookieHeader(sid),
    });
    assert.equal(del.statusCode, 200);
    // clearSessionCookie emits an empty sid cookie alongside the row cascade
    assert.ok(del.cookies.some((c) => c.name === "sid" && c.value === ""));

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid),
    });
    assert.equal(me.statusCode, 401);
    assert.equal(errorCode(me), "UNAUTHORIZED");

    const categories = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    assert.equal(categories.statusCode, 401);

    const patMe = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearerHeader(token),
    });
    assert.equal(patMe.statusCode, 401);
    assert.equal(errorCode(patMe), "UNAUTHORIZED");

    const reRegister = await registerUser(t.app, "alice");
    assert.equal(reRegister.res.statusCode, 200);
    assert.notEqual(reRegister.sid, "");
  });
});

describe("account: meta and registration switch", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("reports registrationOpen true by default", async () => {
    t = await createTestApp();
    const res = await t.app.inject({ method: "GET", url: "/api/meta" });
    assert.equal(res.statusCode, 200);
    assert.equal((json(res) as { registrationOpen: boolean }).registrationOpen, true);
  });

  it("closes registration and reports false when registrationOpen is false", async () => {
    t = await createTestApp({ registrationOpen: false });

    const meta = await t.app.inject({ method: "GET", url: "/api/meta" });
    assert.equal(meta.statusCode, 200);
    assert.equal((json(meta) as { registrationOpen: boolean }).registrationOpen, false);

    const register = await t.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "alice", password: "password1" },
    });
    assert.equal(register.statusCode, 403);
    assert.equal(errorCode(register), "FORBIDDEN");
  });
});