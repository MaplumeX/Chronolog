import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { z } from "zod";
import { AppError, isUniqueViolation, parseBody } from "../src/errors.js";
import { createTestApp, type TestApp } from "./helpers.js";

describe("errors", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("maps AppError thrown from a handler to its status and error body", async () => {
    t = await createTestApp();
    t.app.get("/test-forbidden", async () => {
      throw new AppError(403, "FORBIDDEN", "禁止");
    });

    const res = await t.app.inject({ method: "GET", url: "/test-forbidden" });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: { code: "FORBIDDEN", message: "禁止" } });
  });

  it("maps unknown exceptions to 500 INTERNAL with a generic message", async () => {
    t = await createTestApp();
    t.app.get("/test-boom", async () => {
      throw new Error("boom");
    });

    const res = await t.app.inject({ method: "GET", url: "/test-boom" });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.json(), { error: { code: "INTERNAL", message: "服务器错误" } });
    assert.equal(JSON.stringify(res.json()).includes("boom"), false);
  });

  it("parseBody returns parsed data on success and throws 400 VALIDATION on failure", () => {
    const schema = z.object({ n: z.number() });

    const parsed = parseBody(schema, { n: 42 });
    assert.deepEqual(parsed, { n: 42 });

    assert.throws(
      () => parseBody(schema, { n: "x" }),
      (err: unknown) =>
        err instanceof AppError && err.statusCode === 400 && err.code === "VALIDATION",
    );
  });

  it("replies 404 JSON for unknown /api paths", async () => {
    t = await createTestApp();

    const res = await t.app.inject({ method: "GET", url: "/api/nope" });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: { code: "NOT_FOUND", message: "未找到" } });
  });

  it("replies plain-text 404 for non-api GET when no webDist is configured", async () => {
    t = await createTestApp();

    const res = await t.app.inject({ method: "GET", url: "/some-page" });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body, "Not Found");
  });

  it("isUniqueViolation detects SQLITE_CONSTRAINT_UNIQUE only", () => {
    assert.equal(isUniqueViolation({ code: "SQLITE_CONSTRAINT_UNIQUE" }), true);
    assert.equal(isUniqueViolation(new Error("nope")), false);
    assert.equal(isUniqueViolation({ code: "SQLITE_CONSTRAINT_NOTNULL" }), false);
    assert.equal(isUniqueViolation({}), false);
    assert.equal(isUniqueViolation(null), false);
    assert.equal(isUniqueViolation(undefined), false);
  });
});
