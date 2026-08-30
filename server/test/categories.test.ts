import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";

async function createCategory(
  t: TestApp,
  sid: string,
  body: { name: string; color?: number | null; parentId?: string | null },
) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/categories",
    headers: cookieHeader(sid),
    payload: body,
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
  return json(res) as { id: string; name: string; parentId: string | null };
}

async function listCategories(t: TestApp, sid: string) {
  const res = await t.app.inject({
    method: "GET",
    url: "/api/categories",
    headers: cookieHeader(sid),
  });
  assert.equal(res.statusCode, 200);
  return json(res).categories as { id: string; name: string; parentId: string | null }[];
}

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

  it("two-level hierarchy: create/list child, reject third level and self-parent", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_tree");

    // 用 seed 的顶层分类作 parent（避免与默认分类重名）
    const seeded = await listCategories(t, sid);
    const parent = seeded.find((c) => c.name === "学习");
    const other = seeded.find((c) => c.name === "工作");
    assert.ok(parent && other);
    assert.equal(parent.parentId, null);

    // 建子分类成功，GET 列表返回 parentId
    const child = await createCategory(t, sid, { name: "英语", parentId: parent.id });
    assert.equal(child.parentId, parent.id);
    const listed = await listCategories(t, sid);
    assert.equal(listed.find((c) => c.id === child.id)?.parentId, parent.id);
    assert.equal(listed.find((c) => c.id === parent.id)?.parentId, null);

    // 三级拒绝：parent 已有子节点，不能再挂为子级
    const third = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "三级", parentId: child.id },
    });
    assert.equal(third.statusCode, 409);
    assert.equal((json(third).error as { code: string }).code, "CONFLICT");

    // PATCH：已有子节点的顶层不能变为子级
    const demote = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${parent.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: child.id },
    });
    assert.equal(demote.statusCode, 409);

    // PATCH：自己不能当自己的 parent
    const self = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${child.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: child.id },
    });
    assert.equal(self.statusCode, 409);

    // PATCH：改 parent 到另一个顶层 + 提升回顶层
    const moved = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${child.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: other.id },
    });
    assert.equal(moved.statusCode, 200);
    assert.equal(json(moved).parentId, other.id);
    const promoted = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${child.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: null },
    });
    assert.equal(promoted.statusCode, 200);
    assert.equal(json(promoted).parentId, null);

    // parent 不存在 / 他人分类 → 404
    const missing = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "孤儿", parentId: "no-such-id" },
    });
    assert.equal(missing.statusCode, 404);

    const otherUser = await registerUser(t.app, "cat_tree_other");
    const foreignList = await listCategories(t, otherUser.sid);
    const foreign = foreignList.find((c) => c.name === "学习");
    assert.ok(foreign);
    const steal = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "偷挂", parentId: foreign.id },
    });
    assert.equal(steal.statusCode, 404);
  });

  it("sibling duplicate rejected; duplicate across different parents allowed", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_dup");

    const a = await createCategory(t, sid, { name: "父甲" });
    const b = await createCategory(t, sid, { name: "父乙" });
    await createCategory(t, sid, { name: "英语", parentId: a.id });

    // 同父重名 → 409
    const dup = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "英语", parentId: a.id },
    });
    assert.equal(dup.statusCode, 409);
    assert.equal((json(dup).error as { code: string }).code, "CONFLICT");

    // 顶层重名 → 409
    const dupTop = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "父甲" },
    });
    assert.equal(dupTop.statusCode, 409);

    // 跨父重名 → OK
    const cross = await createCategory(t, sid, { name: "英语", parentId: b.id });
    assert.equal(cross.parentId, b.id);

    // 子级与顶层重名也 OK（不同父范围）
    await createCategory(t, sid, { name: "数学" });
    await createCategory(t, sid, { name: "数学", parentId: a.id });

    // PATCH 改名撞同父兄弟 → 409
    const sibling = await createCategory(t, sid, { name: "法语", parentId: a.id });
    const renameToSibling = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${sibling.id}`,
      headers: cookieHeader(sid),
      payload: { name: "英语" },
    });
    assert.equal(renameToSibling.statusCode, 409);
    // sibling 换到 b 下并改成 b 下不存在的名字 → OK（跨父范围不冲突）
    const renameCross = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${sibling.id}`,
      headers: cookieHeader(sid),
      payload: { name: "德语", parentId: b.id },
    });
    assert.equal(renameCross.statusCode, 200);
    assert.equal(json(renameCross).parentId, b.id);
  });

  it("deleting a parent cascades to children; occupied child or goal-referenced child blocks", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_cascade");

    const parent = await createCategory(t, sid, { name: "临时父" });
    const child1 = await createCategory(t, sid, { name: "子甲", parentId: parent.id });
    const child2 = await createCategory(t, sid, { name: "子乙", parentId: parent.id });

    // 子级无引用：级联删除成功，父子都消失
    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${parent.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);
    assert.equal(json(deleted).ok, true);
    const after = await listCategories(t, sid);
    assert.ok(!after.find((c) => c.id === parent.id));
    assert.ok(!after.find((c) => c.id === child1.id));
    assert.ok(!after.find((c) => c.id === child2.id));

    // 子级有 entry → 父级删除被拦（父级自身无条目）
    const p2 = await createCategory(t, sid, { name: "父二" });
    const c2 = await createCategory(t, sid, { name: "子二", parentId: p2.id });
    await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: c2.id },
    });
    await t.app.inject({
      method: "POST",
      url: "/api/timer/stop",
      headers: cookieHeader(sid),
    });
    const blockedByEntry = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${p2.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(blockedByEntry.statusCode, 409);
    assert.equal((json(blockedByEntry).error as { code: string }).code, "CONFLICT");
    // 父子都还在
    const still = await listCategories(t, sid);
    assert.ok(still.find((c) => c.id === p2.id));
    assert.ok(still.find((c) => c.id === c2.id));

    // 子级被 goal 引用 → 父级删除被拦
    const p3 = await createCategory(t, sid, { name: "父三" });
    const c3 = await createCategory(t, sid, { name: "子三", parentId: p3.id });
    const goal = await t.app.inject({
      method: "POST",
      url: "/api/goals",
      headers: cookieHeader(sid),
      payload: {
        name: "子级目标",
        direction: "gt",
        hours: 1,
        periodUnit: "day",
        categoryId: c3.id,
      },
    });
    assert.equal(goal.statusCode, 200);
    const blockedByGoal = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${p3.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(blockedByGoal.statusCode, 409);
    assert.equal((json(blockedByGoal).error as { code: string }).code, "CONFLICT");
  });
});
