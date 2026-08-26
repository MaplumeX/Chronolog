import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

async function createTag(app: TestApp["app"], sid: string, name: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/tags",
    headers: cookieHeader(sid),
    payload: { name },
  });
  return res;
}

describe("tags", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("creates, lists with entryCount, renames; rejects empty or duplicate names", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_user");

    const empty = await createTag(t.app, sid, "   ");
    assert.equal(empty.statusCode, 400);

    const created = await createTag(t.app, sid, "深度工作");
    assert.equal(created.statusCode, 200);
    const id = json(created).id as string;

    const dup = await createTag(t.app, sid, "深度工作");
    assert.equal(dup.statusCode, 409);

    const rename = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${id}`,
      headers: cookieHeader(sid),
      payload: { name: "专注" },
    });
    assert.equal(rename.statusCode, 200);
    assert.equal(json(rename).name, "专注");

    const list = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sid),
    });
    assert.equal(list.statusCode, 200);
    const tags = json(list).tags as { id: string; name: string; entryCount: number }[];
    assert.equal(tags.length, 1);
    assert.equal(tags[0].name, "专注");
    assert.equal(tags[0].entryCount, 0);
  });

  it("deleting a tag removes its entry associations (cascade)", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_del");
    const tagRes = await createTag(t.app, sid, "会议");
    const tagId = json(tagRes).id as string;

    const catsRes = await t.app.inject({
      method: "GET",
      url: "/api/categories",
      headers: cookieHeader(sid),
    });
    const work = (json(catsRes).categories as { id: string; name: string }[]).find(
      (c) => c.name === "工作",
    );
    assert.ok(work);

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: work.id, tagIds: [tagId] },
    });
    assert.equal(start.statusCode, 200);
    const entryId = (json(start).entry as { id: string }).id;

    const list = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sid),
    });
    const tags = json(list).tags as { id: string; entryCount: number }[];
    assert.equal(tags.find((x) => x.id === tagId)?.entryCount, 1);

    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${tagId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);

    const after = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sid),
    });
    assert.equal((json(after).tags as unknown[]).length, 0);

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { id: string; tags: unknown[] }[];
    const entry = entries.find((e) => e.id === entryId);
    assert.ok(entry);
    assert.deepEqual(entry.tags, []);
  });

  it("cannot touch another user's tag (404)", async () => {
    t = await createTestApp();
    const a = await registerUser(t.app, "tag_a");
    const b = await registerUser(t.app, "tag_b");

    const created = await createTag(t.app, a.sid, "私有");
    const tagId = json(created).id as string;

    const bList = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(b.sid),
    });
    assert.equal((json(bList).tags as unknown[]).length, 0);

    const stealPatch = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${tagId}`,
      headers: cookieHeader(b.sid),
      payload: { name: "偷走" },
    });
    assert.equal(stealPatch.statusCode, 404);

    const stealDelete = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${tagId}`,
      headers: cookieHeader(b.sid),
    });
    assert.equal(stealDelete.statusCode, 404);

    const stealStart = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(b.sid),
      payload: { categoryId: (json(await t.app.inject({
        method: "GET",
        url: "/api/categories",
        headers: cookieHeader(b.sid),
      })).categories as { id: string }[])[0].id, tagIds: [tagId] },
    });
    assert.equal(stealStart.statusCode, 404);
  });
});
