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

async function createTagWithParent(
  t: TestApp,
  sid: string,
  body: { name: string; parentId?: string | null },
) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/tags",
    headers: cookieHeader(sid),
    payload: body,
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
  return json(res) as { id: string; name: string; parentId: string | null };
}

async function listTags(t: TestApp, sid: string) {
  const res = await t.app.inject({
    method: "GET",
    url: "/api/tags",
    headers: cookieHeader(sid),
  });
  assert.equal(res.statusCode, 200);
  return json(res).tags as { id: string; name: string; parentId: string | null }[];
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

  it("color: create/list/patch round-trip; invalid values are rejected", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_color");

    const created = await createTag(t.app, sid, "会议");
    assert.equal(created.statusCode, 200);
    assert.equal(json(created).color, null);
    const id = json(created).id as string;

    const colored = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "专注", color: 5 },
    });
    assert.equal(colored.statusCode, 200);
    assert.equal(json(colored).color, 5);
    const coloredId = json(colored).id as string;

    const list = await t.app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sid),
    });
    assert.equal(list.statusCode, 200);
    const items = json(list).tags as { id: string; color: number | null }[];
    assert.equal(items.find((x) => x.id === id)?.color, null);
    assert.equal(items.find((x) => x.id === coloredId)?.color, 5);

    const setColor = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${id}`,
      headers: cookieHeader(sid),
      payload: { color: 2 },
    });
    assert.equal(setColor.statusCode, 200);
    assert.equal(json(setColor).color, 2);
    assert.equal(json(setColor).name, "会议");

    const setBoth = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${id}`,
      headers: cookieHeader(sid),
      payload: { name: "例会", color: 7 },
    });
    assert.equal(setBoth.statusCode, 200);
    assert.equal(json(setBoth).name, "例会");
    assert.equal(json(setBoth).color, 7);

    const clearColor = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${id}`,
      headers: cookieHeader(sid),
      payload: { color: null },
    });
    assert.equal(clearColor.statusCode, 200);
    assert.equal(json(clearColor).color, null);
    assert.equal(json(clearColor).name, "例会");

    for (const invalid of [0, 9, -1, "red", 1.5]) {
      const badPost = await t.app.inject({
        method: "POST",
        url: "/api/tags",
        headers: cookieHeader(sid),
        payload: { name: `坏${invalid}`, color: invalid },
      });
      assert.equal(badPost.statusCode, 400);
      assert.equal((json(badPost).error as { code: string }).code, "VALIDATION");

      const badPatch = await t.app.inject({
        method: "PATCH",
        url: `/api/tags/${id}`,
        headers: cookieHeader(sid),
        payload: { color: invalid },
      });
      assert.equal(badPatch.statusCode, 400);
      assert.equal((json(badPatch).error as { code: string }).code, "VALIDATION");
    }

    const emptyPatch = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${id}`,
      headers: cookieHeader(sid),
      payload: {},
    });
    assert.equal(emptyPatch.statusCode, 400);
    assert.equal((json(emptyPatch).error as { code: string }).code, "VALIDATION");
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

  it("tag referenced by a goal cannot be deleted; unreferenced still can", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_goal_ref");

    const created = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "专注" },
    });
    assert.equal(created.statusCode, 200);
    const tagId = json(created).id as string;

    const goal = await t.app.inject({
      method: "POST",
      url: "/api/goals",
      headers: cookieHeader(sid),
      payload: {
        name: "限时娱乐",
        direction: "lt",
        hours: 2,
        periodUnit: "day",
        tagId,
      },
    });
    assert.equal(goal.statusCode, 200);

    const occupied = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${tagId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(occupied.statusCode, 409);
    assert.equal((json(occupied).error as { code: string }).code, "CONFLICT");

    const extra = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "无引用" },
    });
    const extraId = json(extra).id as string;
    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${extraId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);
  });

  it("two-level hierarchy: child tags, third level rejected, self-parent rejected", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_tree");

    const parent = await createTagWithParent(t, sid, { name: "工作类" });
    const child = await createTagWithParent(t, sid, { name: "会议", parentId: parent.id });
    assert.equal(child.parentId, parent.id);

    const listed = await listTags(t, sid);
    assert.equal(listed.find((x) => x.id === child.id)?.parentId, parent.id);
    assert.equal(listed.find((x) => x.id === parent.id)?.parentId, null);

    // 三级拒绝：child 已是子级，不能再当 parent
    const third = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "三级", parentId: child.id },
    });
    assert.equal(third.statusCode, 409);
    assert.equal((json(third).error as { code: string }).code, "CONFLICT");

    // PATCH：已有子节点的父级不能挂为子级
    const other = await createTagWithParent(t, sid, { name: "生活类" });
    const demote = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${parent.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: other.id },
    });
    assert.equal(demote.statusCode, 409);

    // PATCH：自己当自己的 parent
    const self = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${child.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: child.id },
    });
    assert.equal(self.statusCode, 409);

    // PATCH：换父 + 提升回顶层
    const moved = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${child.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: other.id },
    });
    assert.equal(moved.statusCode, 200);
    assert.equal(json(moved).parentId, other.id);
    const promoted = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${child.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: null },
    });
    assert.equal(promoted.statusCode, 200);
    assert.equal(json(promoted).parentId, null);

    // 不存在的 parent / 他人标签 → 404
    const missing = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "孤儿", parentId: "no-such-id" },
    });
    assert.equal(missing.statusCode, 404);
    const otherUser = await registerUser(t.app, "tag_tree_other");
    const foreignCreated = await createTag(t.app, otherUser.sid, "别人的标签");
    const foreign = { id: json(foreignCreated).id as string };
    assert.ok(foreign);
    const steal = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "偷挂", parentId: foreign.id },
    });
    assert.equal(steal.statusCode, 404);
  });

  it("sibling duplicate rejected; duplicate across different parents allowed", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_dup");

    const a = await createTagWithParent(t, sid, { name: "父甲" });
    const b = await createTagWithParent(t, sid, { name: "父乙" });
    await createTagWithParent(t, sid, { name: "英语", parentId: a.id });

    // 同父重名 → 409
    const dup = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "英语", parentId: a.id },
    });
    assert.equal(dup.statusCode, 409);
    assert.equal((json(dup).error as { code: string }).code, "CONFLICT");

    // 顶层重名 → 409
    const dupTop = await t.app.inject({
      method: "POST",
      url: "/api/tags",
      headers: cookieHeader(sid),
      payload: { name: "父甲" },
    });
    assert.equal(dupTop.statusCode, 409);

    // 跨父重名 → OK；子级与顶层重名也 OK
    const cross = await createTagWithParent(t, sid, { name: "英语", parentId: b.id });
    assert.equal(cross.parentId, b.id);
    await createTagWithParent(t, sid, { name: "数学" });
    await createTagWithParent(t, sid, { name: "数学", parentId: a.id });

    // PATCH 改名撞同父兄弟 → 409
    const sibling = await createTagWithParent(t, sid, { name: "法语", parentId: a.id });
    const renameToSibling = await t.app.inject({
      method: "PATCH",
      url: `/api/tags/${sibling.id}`,
      headers: cookieHeader(sid),
      payload: { name: "英语" },
    });
    assert.equal(renameToSibling.statusCode, 409);
  });

  it("deleting a parent tag cascades to children; goal-referenced child blocks", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "tag_cascade");

    const parent = await createTagWithParent(t, sid, { name: "父标签" });
    const child1 = await createTagWithParent(t, sid, { name: "子甲", parentId: parent.id });
    const child2 = await createTagWithParent(t, sid, { name: "子乙", parentId: parent.id });

    // 子级挂有 entry_tags：级联删除时 entry_tags 自然解除关联
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
      payload: { categoryId: work.id, tagIds: [child1.id] },
    });
    assert.equal(start.statusCode, 200);
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });

    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${parent.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);
    const after = await listTags(t, sid);
    assert.ok(!after.find((x) => x.id === parent.id));
    assert.ok(!after.find((x) => x.id === child1.id));
    assert.ok(!after.find((x) => x.id === child2.id));

    // entry 仍在，但 tags 已被级联清空
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { tags: unknown[] }[];
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].tags, []);

    // 子级被 goal 引用 → 父级删除被拦
    const p2 = await createTagWithParent(t, sid, { name: "父二" });
    const c2 = await createTagWithParent(t, sid, { name: "子二", parentId: p2.id });
    const goal = await t.app.inject({
      method: "POST",
      url: "/api/goals",
      headers: cookieHeader(sid),
      payload: {
        name: "子级目标",
        direction: "lt",
        hours: 2,
        periodUnit: "day",
        tagId: c2.id,
      },
    });
    assert.equal(goal.statusCode, 200);
    const blocked = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${p2.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(blocked.statusCode, 409);
    assert.equal((json(blocked).error as { code: string }).code, "CONFLICT");
    // 清除引用后可删
    const goalId = json(goal).id as string;
    await t.app.inject({
      method: "PATCH",
      url: `/api/goals/${goalId}`,
      headers: cookieHeader(sid),
      payload: { tagId: null },
    });
    const unblocked = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${p2.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(unblocked.statusCode, 200);
  });
});
