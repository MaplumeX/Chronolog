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
  return json(res).categories as { id: string; name: string; parentId: string | null; archivedAt: string | null }[];
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

  it("deleting a category with entries unlinks them to uncategorized (task 08-31)", async () => {
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

    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${work.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);

    // 条目变未分类：categoryName 兑底 + today 列表正常返回
    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal(today.statusCode, 200);
    const entries = json(today).entries as { categoryId: string | null; categoryName: string }[];
    assert.ok(entries.length >= 1);
    assert.ok(entries.every((e) => e.categoryId === null && e.categoryName === "未分类"));
  });

  it("deleting a category with a running timer keeps the timer running as uncategorized", async () => {
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
    const started = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: rest.id },
    });
    assert.equal(started.statusCode, 200);
    const entryId = (json(started).entry as { id: string }).id;

    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${rest.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);

    const current = await t.app.inject({
      method: "GET",
      url: "/api/timer/current",
      headers: cookieHeader(sid),
    });
    assert.equal(current.statusCode, 200);
    const running = json(current).entry as {
      id: string;
      categoryId: string | null;
      categoryName: string;
      stoppedAt: string | null;
    };
    assert.equal(running.id, entryId);
    assert.equal(running.categoryId, null);
    assert.equal(running.categoryName, "未分类");
    assert.equal(running.stoppedAt, null);
  });

  it("deleting a category referenced by a goal unlinks the goal (categoryId -> null)", async () => {
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
    const goalId = json(goal).id as string;

    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${study.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);

    const goalsRes = await t.app.inject({
      method: "GET",
      url: "/api/goals?tz=UTC",
      headers: cookieHeader(sid),
    });
    assert.equal(goalsRes.statusCode, 200);
    const goals = json(goalsRes).goals as { id: string; categoryId: string | null }[];
    const found = goals.find((g) => g.id === goalId);
    assert.ok(found);
    assert.equal(found.categoryId, null);
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

  it("deleting a parent cascades to children; entries and goals under children are unlinked", async () => {
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

    // 子级有 entry + goal 引用：级联删除仍成功，条目变未分类、goal 解除引用
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
    const goal = await t.app.inject({
      method: "POST",
      url: "/api/goals",
      headers: cookieHeader(sid),
      payload: {
        name: "子级目标",
        direction: "gt",
        hours: 1,
        periodUnit: "day",
        categoryId: c2.id,
      },
    });
    assert.equal(goal.statusCode, 200);
    const goalId = json(goal).id as string;

    const cascaded = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${p2.id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(cascaded.statusCode, 200);
    const still = await listCategories(t, sid);
    assert.ok(!still.find((c) => c.id === p2.id));
    assert.ok(!still.find((c) => c.id === c2.id));

    const today = await t.app.inject({
      method: "GET",
      url: "/api/entries/today?tz=UTC",
      headers: cookieHeader(sid),
    });
    const entries = json(today).entries as { categoryId: string | null; categoryName: string }[];
    assert.ok(entries.every((e) => e.categoryId === null && e.categoryName === "未分类"));

    const goalsRes = await t.app.inject({
      method: "GET",
      url: "/api/goals?tz=UTC",
      headers: cookieHeader(sid),
    });
    const goals = json(goalsRes).goals as { id: string; categoryId: string | null }[];
    assert.equal(goals.find((g) => g.id === goalId)?.categoryId, null);
  });

  it("archive/unarchive: parent cascades down, child archive is isolated, unarchive restores ancestor chain", async () => {
    const c: { value: Date } = { value: new Date("2026-08-31T00:00:00.000Z") };
    t = await createTestApp({ now: () => c.value });
    const { sid } = await registerUser(t.app, "cat_archive");

    const seeded = await listCategories(t, sid);
    const parent = seeded.find((x) => x.name === "学习");
    assert.ok(parent);
    const child1 = await createCategory(t, sid, { name: "英语", parentId: parent.id });
    const child2 = await createCategory(t, sid, { name: "数学", parentId: parent.id });

    // 列表返回 archivedAt: null
    const before = await listCategories(t, sid);
    assert.equal(before.find((x) => x.id === parent.id)?.archivedAt, null);

    // 归档父级 → 所有子分类一并归档
    const archive = await t.app.inject({
      method: "POST",
      url: `/api/categories/${parent.id}/archive`,
      headers: cookieHeader(sid),
    });
    assert.equal(archive.statusCode, 200);
    assert.equal((json(archive) as { archivedAt: string | null }).archivedAt, "2026-08-31T00:00:00.000Z");
    const archived = await listCategories(t, sid);
    assert.equal(archived.find((x) => x.id === parent.id)?.archivedAt, "2026-08-31T00:00:00.000Z");
    assert.equal(archived.find((x) => x.id === child1.id)?.archivedAt, "2026-08-31T00:00:00.000Z");
    assert.equal(archived.find((x) => x.id === child2.id)?.archivedAt, "2026-08-31T00:00:00.000Z");

    // 归档分类不能作为父级（创建/移动均拒绝）
    const createUnder = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "新子", parentId: parent.id },
    });
    assert.equal(createUnder.statusCode, 409);
    assert.equal((json(createUnder).error as { code: string }).code, "CONFLICT");
    const moveUnder = await t.app.inject({
      method: "PATCH",
      url: `/api/categories/${seeded.find((x) => x.name === "工作")!.id}`,
      headers: cookieHeader(sid),
      payload: { parentId: parent.id },
    });
    assert.equal(moveUnder.statusCode, 409);

    // 取消归档子分类 → 级联恢复父级链（父级也恢复）
    c.value = new Date("2026-08-31T01:00:00.000Z");
    const unarchive = await t.app.inject({
      method: "POST",
      url: `/api/categories/${child1.id}/unarchive`,
      headers: cookieHeader(sid),
    });
    assert.equal(unarchive.statusCode, 200);
    const restored = await listCategories(t, sid);
    assert.equal(restored.find((x) => x.id === child1.id)?.archivedAt, null);
    assert.equal(restored.find((x) => x.id === parent.id)?.archivedAt, null, "父级链应被级联恢复");
    // 兄弟分类不连带恢复
    assert.equal(restored.find((x) => x.id === child2.id)?.archivedAt, "2026-08-31T00:00:00.000Z");
  });

  it("archive child only: parent stays active; unarchive parent does not restore archived child", async () => {
    t = await createTestApp();
    const { sid } = await registerUser(t.app, "cat_archive_child");

    const seeded = await listCategories(t, sid);
    const parent = seeded.find((x) => x.name === "学习");
    assert.ok(parent);
    const child = await createCategory(t, sid, { name: "英语", parentId: parent.id });

    // 单独归档子分类：仅自身，父级保持活动
    const archive = await t.app.inject({
      method: "POST",
      url: `/api/categories/${child.id}/archive`,
      headers: cookieHeader(sid),
    });
    assert.equal(archive.statusCode, 200);
    const after = await listCategories(t, sid);
    assert.ok(after.find((x) => x.id === child.id)!.archivedAt);
    assert.equal(after.find((x) => x.id === parent.id)!.archivedAt, null);

    // 取消归档父级（未归档时幂等）：不影响已归档子分类
    const unarchive = await t.app.inject({
      method: "POST",
      url: `/api/categories/${parent.id}/unarchive`,
      headers: cookieHeader(sid),
    });
    assert.equal(unarchive.statusCode, 200);
    const after2 = await listCategories(t, sid);
    assert.ok(after2.find((x) => x.id === child.id)!.archivedAt);

    // 归档分类与活动分类共享命名空间：同父下与归档子分类重名仍拒绝
    const dup = await t.app.inject({
      method: "POST",
      url: "/api/categories",
      headers: cookieHeader(sid),
      payload: { name: "英语", parentId: parent.id },
    });
    assert.equal(dup.statusCode, 409);
  });

  it("archive/unarchive isolation: foreign or missing category is 404", async () => {
    t = await createTestApp();
    { const { sid } = await registerUser(t.app, "cat_archive_owner");
      const seeded = await listCategories(t, sid);
      const mine = seeded[0];
      const other = await registerUser(t.app, "cat_archive_other");

      const foreign = await t.app.inject({
        method: "POST",
        url: `/api/categories/${mine.id}/archive`,
        headers: cookieHeader(other.sid),
      });
      assert.equal(foreign.statusCode, 404);

      const missing = await t.app.inject({
        method: "POST",
        url: "/api/categories/no-such-id/archive",
        headers: cookieHeader(sid),
      });
      assert.equal(missing.statusCode, 404);
      const missingUn = await t.app.inject({
        method: "POST",
        url: "/api/categories/no-such-id/unarchive",
        headers: cookieHeader(sid),
      });
      assert.equal(missingUn.statusCode, 404);
    }
  });
});
