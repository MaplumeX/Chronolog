import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cookieHeader, createTestApp, json, registerUser, type TestApp } from "./helpers.js";
import type { LightMyRequestResponse } from "fastify";

// Asia/Shanghai 本地 2026-08-25（周二）10:00
const NOW = new Date("2026-08-25T02:00:00.000Z");
const TZ = "Asia/Shanghai";

async function getCategories(t: TestApp, sid: string) {
  const res = await t.app.inject({
    method: "GET",
    url: "/api/categories",
    headers: cookieHeader(sid),
  });
  return json(res).categories as { id: string; name: string }[];
}

async function getCategoryId(t: TestApp, sid: string, name: string) {
  const cats = await getCategories(t, sid);
  const cat = cats.find((c) => c.name === name);
  assert.ok(cat, `category ${name} missing`);
  return cat.id;
}

async function createTag(t: TestApp, sid: string, name: string) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/tags",
    headers: cookieHeader(sid),
    payload: { name },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
  return json(res).id as string;
}

async function createGoal(
  t: TestApp,
  sid: string,
  body: Record<string, unknown>,
): Promise<{ res: LightMyRequestResponse; id: string }> {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/goals",
    headers: cookieHeader(sid),
    payload: body,
  });
  return { res, id: (res.json() as { id?: string }).id ?? "" };
}

async function createEntry(
  t: TestApp,
  sid: string,
  body: {
    categoryId: string;
    description: string;
    tagIds: string[];
    startedAt: string;
    stoppedAt: string;
  },
) {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/entries",
    headers: cookieHeader(sid),
    payload: body,
  });
  assert.equal(res.statusCode, 201, JSON.stringify(res.json()));
}

async function listGoals(t: TestApp, sid: string, tz = TZ) {
  const res = await t.app.inject({
    method: "GET",
    url: `/api/goals?tz=${encodeURIComponent(tz)}`,
    headers: cookieHeader(sid),
  });
  return {
    res,
    goals:
      res.statusCode === 200
        ? (json(res).goals as {
            id: string;
            name: string;
            icon: string;
            categoryId: string | null;
            tagId: string | null;
            direction: "lt" | "gt";
            hours: number;
            periodUnit: "day" | "week" | "month";
            dueDate: string | null;
            progress: { currentSeconds: number | null; targetSeconds: number };
            status: "active" | "achieved" | "expired";
          }[])
        : null,
  };
}

describe("goals", () => {
  let t: TestApp;
  afterEach(async () => {
    await t?.close();
  });

  it("CRUD round-trip: create, list with progress, patch, delete", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_crud");
    const studyId = await getCategoryId(t, sid, "学习");

    const { res: created } = await createGoal(t, sid, {
      name: "每日学习",
      direction: "gt",
      hours: 2,
      periodUnit: "day",
      categoryId: studyId,
    });
    assert.equal(created.statusCode, 200, JSON.stringify(created));
    const id = (created.json() as { id: string }).id;

    const { res: listRes, goals } = await listGoals(t, sid);
    assert.equal(listRes.statusCode, 200);
    assert.equal(goals?.length, 1);
    const g = goals![0];
    assert.equal(g.name, "每日学习");
    assert.equal(g.icon, "🎯"); // 默认 icon
    assert.equal(g.categoryId, studyId);
    assert.equal(g.direction, "gt");
    assert.equal(g.periodUnit, "day");
    assert.equal(g.dueDate, null);
    assert.equal(g.progress.currentSeconds, 0);
    assert.equal(g.progress.targetSeconds, 7200);
    assert.equal(g.status, "active");

    // PATCH 更新各字段
    const tagId = await createTag(t, sid, "专注");
    const patched = await t.app.inject({
      method: "PATCH",
      url: `/api/goals/${id}`,
      headers: cookieHeader(sid),
      payload: {
        name: "每周专注",
        icon: "💪",
        tagId,
        direction: "lt",
        hours: 5,
        periodUnit: "week",
        dueDate: "2026-12-31",
      },
    });
    assert.equal(patched.statusCode, 200, JSON.stringify(patched.json()));
    const p = json(patched) as Record<string, unknown>;
    assert.equal(p.name, "每周专注");
    assert.equal(p.icon, "💪");
    assert.equal(p.tagId, tagId);
    assert.equal(p.direction, "lt");
    assert.equal(p.hours, 5);
    assert.equal(p.periodUnit, "week");
    assert.equal(p.dueDate, "2026-12-31");

    // dueDate: null 清除
    const cleared = await t.app.inject({
      method: "PATCH",
      url: `/api/goals/${id}`,
      headers: cookieHeader(sid),
      payload: { dueDate: null },
    });
    assert.equal(cleared.statusCode, 200);
    assert.equal((json(cleared) as Record<string, unknown>).dueDate, null);

    // DELETE
    const deleted = await t.app.inject({
      method: "DELETE",
      url: `/api/goals/${id}`,
      headers: cookieHeader(sid),
    });
    assert.equal(deleted.statusCode, 200);
    const after = await listGoals(t, sid);
    assert.equal(after.goals?.length, 0);
  });

  it("validation: empty name, non-positive hours, invalid dueDate, missing category/tag, empty patch", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_valid");

    const cases: { body: Record<string, unknown>; status: number }[] = [
      { body: { name: "   ", direction: "gt", hours: 1, periodUnit: "day" }, status: 400 },
      { body: { direction: "gt", hours: 1, periodUnit: "day" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: 0, periodUnit: "day" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: -1, periodUnit: "day" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: 1001, periodUnit: "day" }, status: 400 },
      { body: { name: "x", direction: "bad", hours: 1, periodUnit: "day" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: 1, periodUnit: "year" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: 1, periodUnit: "day", dueDate: "2026-02-30" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: 1, periodUnit: "day", dueDate: "not-a-date" }, status: 400 },
      { body: { name: "x", direction: "gt", hours: 1, periodUnit: "day", categoryId: "missing" }, status: 404 },
      { body: { name: "x", direction: "gt", hours: 1, periodUnit: "day", tagId: "missing" }, status: 404 },
    ];
    for (const { body, status } of cases) {
      const { res } = await createGoal(t, sid, body);
      assert.equal(res.statusCode, status, JSON.stringify(body));
    }

    // 无效 tz
    const badTz = await t.app.inject({
      method: "GET",
      url: "/api/goals?tz=Not/AZone",
      headers: cookieHeader(sid),
    });
    assert.equal(badTz.statusCode, 400);

    // 空 PATCH
    const { id } = await createGoal(t, sid, {
      name: "ok",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
    });
    const emptyPatch = await t.app.inject({
      method: "PATCH",
      url: `/api/goals/${id}`,
      headers: cookieHeader(sid),
      payload: {},
    });
    assert.equal(emptyPatch.statusCode, 400);
  });

  it("cross-user access is 404; other user's category/tag ids are 404", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid: alice } = await registerUser(t.app, "goal_alice");
    const { sid: bob } = await registerUser(t.app, "goal_bob");
    const aliceStudy = await getCategoryId(t, alice, "学习");
    const bobStudy = await getCategoryId(t, bob, "学习");

    // bob 用 alice 的 categoryId 创建 → 404
    const { res } = await createGoal(t, bob, {
      name: "越权",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: aliceStudy,
    });
    assert.equal(res.statusCode, 404);

    const { id } = await createGoal(t, alice, {
      name: "alice 的目标",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: aliceStudy,
    });

    // bob 访问 alice 的 goal → 404（PATCH / DELETE / 列表不可见）
    for (const method of ["PATCH", "DELETE"] as const) {
      const r = await t.app.inject({
        method,
        url: `/api/goals/${id}`,
        headers: cookieHeader(bob),
        payload: method === "PATCH" ? { name: "hack" } : undefined,
      });
      assert.equal(r.statusCode, 404);
    }
    const bobList = await listGoals(t, bob);
    assert.equal(bobList.goals?.length, 0);

    // alice 用 bob 的 tagId PATCH → 404
    const bobTag = await createTag(t, bob, "bob标签");
    const badPatch = await t.app.inject({
      method: "PATCH",
      url: `/api/goals/${id}`,
      headers: cookieHeader(alice),
      payload: { tagId: bobTag },
    });
    assert.equal(badPatch.statusCode, 404);
    // bobStudy 未被引用，仅作隔离参照
    assert.ok(bobStudy);
  });

  it("day window: cross-midnight entries clip at the window; running entries clip at now (AC2)", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_day");
    const studyId = await getCategoryId(t, sid, "学习");

    // 昨晚 23:00 开始、今天 01:00 结束（上海本地）：当天窗口只计 1h（00:00–01:00）
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "跨午夜",
      tagIds: [],
      startedAt: "2026-08-24T15:00:00.000Z", // 上海 23:00
      stoppedAt: "2026-08-24T17:00:00.000Z", // 上海 08-25 01:00
    });
    // 今天 09:00–09:30（上海）
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "上午",
      tagIds: [],
      startedAt: "2026-08-25T01:00:00.000Z",
      stoppedAt: "2026-08-25T01:30:00.000Z",
    });
    // 运行中条目的 now 截断在下一用例单独覆盖（timer start 的 startedAt = 注入 now）。

    // 目标：每天 > 1.5h 学习
    const { id } = await createGoal(t, sid, {
      name: "学习",
      direction: "gt",
      hours: 1.5,
      periodUnit: "day",
      categoryId: studyId,
    });
    const listed = await listGoals(t, sid, TZ);
    const g = listed.goals!.find((x) => x.id === id)!;
    // 1h（跨午夜截断）+ 0.5h = 1.5h = 5400s → 恰好达成（gt 且 current >= target）
    assert.equal(g.progress.currentSeconds, 5400);
    assert.equal(g.status, "achieved");
  });

  it("running entries clip at now within the day window (AC2)", async () => {
    // 用注入 now：上海 2026-08-25 11:00。先以 t0 = 10:00 启动计时（startedAt 早于 now），
    // 再用同一 db、更晚的 now 重新建 app 查询，验证运行中条目按查询时的 now 截断。
    const t0 = new Date("2026-08-25T02:00:00.000Z"); // 上海 10:00
    t = await createTestApp({ now: () => t0, keepDir: true });
    const { sid } = await registerUser(t.app, "goal_running");
    const studyId = await getCategoryId(t, sid, "学习");

    const start = await t.app.inject({
      method: "POST",
      url: "/api/timer/start",
      headers: cookieHeader(sid),
      payload: { categoryId: studyId },
    });
    assert.equal(start.statusCode, 200);
    const dbPath = t.dbPath;
    await t.close(); // 关闭但保留 db 文件

    // 1 小时后（上海 11:00）重新打开同一 db：运行中条目计 1h
    const t1 = await createTestApp({ now: () => new Date("2026-08-25T03:00:00.000Z"), dbPath });
    const { id } = await createGoal(t1, sid, {
      name: "运行",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
    });
    const listed = await listGoals(t1, sid, TZ);
    const g = listed.goals!.find((x) => x.id === id)!;
    assert.equal(g.progress.currentSeconds, 3600); // 10:00 → now(11:00)
    assert.equal(g.status, "achieved");
    await t1.close();
    // 清理保留的临时目录
    const fs = await import("node:fs");
    fs.rmSync(t.dir, { recursive: true, force: true });
  });

  it("week and month windows: entries outside the current period are not counted (AC2)", async () => {
    t = await createTestApp({ now: () => NOW }); // 上海 周二 2026-08-25
    const { sid } = await registerUser(t.app, "goal_week");
    const studyId = await getCategoryId(t, sid, "学习");

    // 本周一（08-24）上海 08:00–09:00 → 属于本周
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "周一",
      tagIds: [],
      startedAt: "2026-08-24T00:00:00.000Z",
      stoppedAt: "2026-08-24T01:00:00.000Z",
    });
    // 上周日（08-23，上海）→ 属于上周，不计
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "上周日",
      tagIds: [],
      startedAt: "2026-08-23T02:00:00.000Z",
      stoppedAt: "2026-08-23T04:00:00.000Z",
    });

    const { id: weekId } = await createGoal(t, sid, {
      name: "周目标",
      direction: "gt",
      hours: 1,
      periodUnit: "week",
      categoryId: studyId,
    });
    // 月窗口：本月（08-01 起）两条都在 8 月 → 3h 总计
    const { id: monthId } = await createGoal(t, sid, {
      name: "月目标",
      direction: "gt",
      hours: 2,
      periodUnit: "month",
      categoryId: studyId,
    });
    const listedMonth = await listGoals(t, sid, TZ);
    const week = listedMonth.goals!.find((x) => x.id === weekId)!;
    // 本周（周一 08-24 起）只有 1h（周一条目）；上周日不计
    assert.equal(week.progress.currentSeconds, 3600);
    assert.equal(week.status, "achieved");
    const month = listedMonth.goals!.find((x) => x.id === monthId)!;
    assert.equal(month.progress.currentSeconds, 3 * 3600);
    assert.equal(month.status, "achieved");

    // 7 月条目不计入月窗口
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "七月",
      tagIds: [],
      startedAt: "2026-07-31T02:00:00.000Z",
      stoppedAt: "2026-07-31T04:00:00.000Z",
    });
    const listed2 = await listGoals(t, sid, TZ);
    const month2 = listed2.goals!.find((x) => x.id === monthId)!;
    assert.equal(month2.progress.currentSeconds, 3 * 3600);
  });

  it("AND semantics: category + tag goal counts only entries matching both (AC3)", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_and");
    const studyId = await getCategoryId(t, sid, "学习");
    const workId = await getCategoryId(t, sid, "工作");
    const tagId = await createTag(t, sid, "专注");

    // 学习 + 专注：1h（计入）
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "a",
      tagIds: [tagId],
      startedAt: "2026-08-25T01:00:00.000Z",
      stoppedAt: "2026-08-25T02:00:00.000Z",
    });
    // 学习 无标签：1h（不计）
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "b",
      tagIds: [],
      startedAt: "2026-08-25T02:00:00.000Z",
      stoppedAt: "2026-08-25T03:00:00.000Z",
    });
    // 工作 + 专注：1h（不计）
    await createEntry(t, sid, {
      categoryId: workId,
      description: "c",
      tagIds: [tagId],
      startedAt: "2026-08-25T03:00:00.000Z",
      stoppedAt: "2026-08-25T04:00:00.000Z",
    });

    const { id } = await createGoal(t, sid, {
      name: "AND",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
      tagId,
    });
    const listed = await listGoals(t, sid, TZ);
    const g = listed.goals!.find((x) => x.id === id)!;
    assert.equal(g.progress.currentSeconds, 3600);
    assert.equal(g.status, "achieved");

    // 仅标签：统计带该标签的全部条目（学习+专注 与 工作+专注 = 2h）
    const { id: tagOnlyId } = await createGoal(t, sid, {
      name: "仅标签",
      direction: "gt",
      hours: 2,
      periodUnit: "day",
      tagId,
    });
    const listed2 = await listGoals(t, sid, TZ);
    const tagOnly = listed2.goals!.find((x) => x.id === tagOnlyId)!;
    assert.equal(tagOnly.progress.currentSeconds, 2 * 3600);
  });

  it("status judgement: gt achieved at threshold; lt achieved under, active when exceeded (AC4)", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_status");
    const studyId = await getCategoryId(t, sid, "学习");

    // 2h 条目
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "x",
      tagIds: [],
      startedAt: "2026-08-25T01:00:00.000Z",
      stoppedAt: "2026-08-25T03:00:00.000Z",
    });

    // gt 且 current(2h) >= target(2h) → achieved（边界取 >=）
    const { id: gtId } = await createGoal(t, sid, {
      name: "gt 边界",
      direction: "gt",
      hours: 2,
      periodUnit: "day",
      categoryId: studyId,
    });
    // lt 且 current(2h) < target(3h) → achieved
    const { id: ltId } = await createGoal(t, sid, {
      name: "lt 未超",
      direction: "lt",
      hours: 3,
      periodUnit: "day",
      categoryId: studyId,
    });
    // lt 且 current(2h) >= target(2h) → active（超限，前端按数值渲染超限）
    const { id: ltExceededId } = await createGoal(t, sid, {
      name: "lt 超限",
      direction: "lt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
    });

    const { goals } = await listGoals(t, sid, TZ);
    assert.equal(goals!.find((x) => x.id === gtId)!.status, "achieved");
    assert.equal(goals!.find((x) => x.id === ltId)!.status, "achieved");
    assert.equal(goals!.find((x) => x.id === ltExceededId)!.status, "active");
  });

  it("expired goals: dueDate before tz-local today → expired, currentSeconds null (AC5)", async () => {
    t = await createTestApp({ now: () => NOW }); // 上海 2026-08-25
    const { sid } = await registerUser(t.app, "goal_expire");
    const studyId = await getCategoryId(t, sid, "学习");

    // 今天有 1h 条目（但目标已过期，不应统计）
    await createEntry(t, sid, {
      categoryId: studyId,
      description: "x",
      tagIds: [],
      startedAt: "2026-08-25T01:00:00.000Z",
      stoppedAt: "2026-08-25T02:00:00.000Z",
    });

    // dueDate = 昨天（上海本地 2026-08-24）→ 过期
    const { id: expiredId } = await createGoal(t, sid, {
      name: "过期",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
      dueDate: "2026-08-24",
    });
    // dueDate = 今天 → 未过期
    const { id: todayId } = await createGoal(t, sid, {
      name: "今天截止",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
      dueDate: "2026-08-25",
    });
    // 未来 dueDate → 未过期
    const { id: futureId } = await createGoal(t, sid, {
      name: "未来",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
      dueDate: "2026-12-31",
    });

    const { goals } = await listGoals(t, sid, TZ);
    const expired = goals!.find((x) => x.id === expiredId)!;
    assert.equal(expired.status, "expired");
    assert.equal(expired.progress.currentSeconds, null);
    assert.equal(expired.progress.targetSeconds, 3600);
    const today = goals!.find((x) => x.id === todayId)!;
    assert.equal(today.status, "achieved"); // 1h >= 1h
    assert.equal(today.progress.currentSeconds, 3600);
    const future = goals!.find((x) => x.id === futureId)!;
    assert.equal(future.status, "achieved");
  });

  it("deleting a category referenced by a goal unlinks it (categoryId -> null) instead of blocking (task 08-31)", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_ref");
    const studyId = await getCategoryId(t, sid, "学习");
    const tagId = await createTag(t, sid, "专注");

    const created = await createGoal(t, sid, {
      name: "引用分类",
      direction: "gt",
      hours: 1,
      periodUnit: "day",
      categoryId: studyId,
    });
    const catDelete = await t.app.inject({
      method: "DELETE",
      url: `/api/categories/${studyId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(catDelete.statusCode, 200);
    // 引用被置空而非阻止
    const listed = await listGoals(t, sid, TZ);
    const catGoal = listed.goals!.find((x) => x.id === created.id)!;
    assert.equal(catGoal.categoryId, null);

    // 标签引用仍阻止删除（tags 不在本任务范围）
    await createGoal(t, sid, {
      name: "引用标签",
      direction: "lt",
      hours: 8,
      periodUnit: "day",
      tagId,
    });
    const tagDelete = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${tagId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(tagDelete.statusCode, 409);
    assert.equal((json(tagDelete).error as { code: string }).code, "CONFLICT");
  });

  it("unassociated category/tag can still be deleted (regression for delete protection)", async () => {
    t = await createTestApp({ now: () => NOW });
    const { sid } = await registerUser(t.app, "goal_unref");
    const tagId = await createTag(t, sid, "无引用");
    const tagDelete = await t.app.inject({
      method: "DELETE",
      url: `/api/tags/${tagId}`,
      headers: cookieHeader(sid),
    });
    assert.equal(tagDelete.statusCode, 200);
  });
});
