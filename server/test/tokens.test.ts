import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

function bearerHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("api tokens", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("creates a token, returns the plaintext once, and stores only the hash", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "alice");

    const res = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: { name: "my-cli" },
      headers: cookieHeader(sid),
    });
    assert.equal(res.statusCode, 200);
    const body = json(res) as { id: string; name: string; token: string; createdAt: string };
    assert.match(body.token, /^ctt_[A-Za-z0-9_-]+$/);
    assert.equal(body.name, "my-cli");

    const sqlite = new Database(t.dbPath, { readonly: true });
    try {
      const stored = sqlite
        .prepare("SELECT token_hash FROM api_tokens")
        .all() as { token_hash: string }[];
      assert.equal(stored.length, 1);
      assert.equal(stored[0].token_hash.length, 64);
      assert.ok(!stored[0].token_hash.includes(body.token));
    } finally {
      sqlite.close();
    }
  });

  it("authenticates /api/auth/me with a Bearer token", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "bob");
    const created = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: { name: "cli" },
      headers: cookieHeader(sid),
    });
    const token = (json(created) as { token: string }).token;

    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearerHeader(token),
    });
    assert.equal(me.statusCode, 200);
    assert.equal((json(me) as { username: string }).username, "bob");
  });

  it("rejects invalid and revoked tokens with 401", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "carol");
    const created = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: { name: "cli" },
      headers: cookieHeader(sid),
    });
    const { token, id } = json(created) as { token: string; id: string };

    const bad = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearerHeader("ctt_notavalidtoken"),
    });
    assert.equal(bad.statusCode, 401);
    assert.equal((json(bad).error as { code: string }).code, "UNAUTHORIZED");

    const del = await t.app.inject({
      method: "DELETE",
      url: `/api/tokens/${id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(del.statusCode, 200);

    const revoked = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearerHeader(token),
    });
    assert.equal(revoked.statusCode, 401);
  });

  it("keeps cookie auth unaffected when no Authorization header is sent", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "dana");
    const me = await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(sid),
    });
    assert.equal(me.statusCode, 200);
    assert.equal((json(me) as { username: string }).username, "dana");
  });

  it("validates the token name", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "erin");

    const missing = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: {},
      headers: cookieHeader(sid),
    });
    assert.equal(missing.statusCode, 400);
    assert.equal((json(missing).error as { code: string }).code, "VALIDATION");

    const tooLong = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: { name: "x".repeat(65) },
      headers: cookieHeader(sid),
    });
    assert.equal(tooLong.statusCode, 400);
  });

  it("returns 404 when deleting a token of another user or an unknown id", async () => {
    t = await createTestApp();
    const alice = await registerUser(t.app, "alice");
    const created = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: { name: "cli" },
      headers: cookieHeader(alice.sid),
    });
    const { id } = json(created) as { id: string };

    const bob = await registerUser(t.app, "bob");
    const cross = await t.app.inject({
      method: "DELETE",
      url: `/api/tokens/${id}`,
      headers: cookieHeader(bob.sid),
    });
    assert.equal(cross.statusCode, 404);

    const unknown = await t.app.inject({
      method: "DELETE",
      url: "/api/tokens/no-such-id",
      headers: cookieHeader(alice.sid),
    });
    assert.equal(unknown.statusCode, 404);
  });

  it("updates lastUsedAt on Bearer auth", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "frank");
    const created = await t.app.inject({
      method: "POST",
      url: "/api/tokens",
      payload: { name: "cli" },
      headers: cookieHeader(sid),
    });
    const { token } = json(created) as { token: string };

    const before = await t.app.inject({
      method: "GET",
      url: "/api/tokens",
      headers: cookieHeader(sid),
    });
    assert.equal((json(before).tokens as { lastUsedAt: string | null }[])[0].lastUsedAt, null);

    await t.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearerHeader(token),
    });

    const after = await t.app.inject({
      method: "GET",
      url: "/api/tokens",
      headers: cookieHeader(sid),
    });
    const used = (json(after).tokens as { lastUsedAt: string | null }[])[0].lastUsedAt;
    assert.ok(used);
    assert.match(used, /Z$/);
  });
});