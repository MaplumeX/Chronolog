import { DateTime } from "luxon";
import { and, count, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, parseBody } from "../errors.js";
import { listGoalsWithProgress } from "../goals.js";
import { categories, goals, tags } from "../schema.js";
import { requireTz } from "../time.js";

/** dueDate 校验：YYYY-MM-DD 且为真实日历日期（复用 time.ts 的日期校验思路，含滚溢出拒绝）。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDueDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = DateTime.fromISO(date, { zone: "utc" });
  return d.isValid && d.toISODate() === date;
}

const dueDateField = z
  .string()
  .refine(isValidDueDate, "截止日期无效")
  .nullable();

const directionField = z.enum(["lt", "gt"], { message: "方向须为少于或大于" });
const periodUnitField = z.enum(["day", "week", "month"], { message: "周期单位无效" });

const createBody = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "目标名不能为空").max(32, "目标名过长")),
  icon: z
    .string()
    .min(1, "图标不能为空")
    .max(8, "图标过长")
    .default("🎯"),
  categoryId: z.string().min(1).nullable().optional(),
  tagId: z.string().min(1).nullable().optional(),
  direction: directionField,
  hours: z
    .number({ message: "小时数须为正数" })
    .positive("小时数须为正数")
    .max(1000, "小时数过大"),
  periodUnit: periodUnitField,
  dueDate: dueDateField.optional(),
});

const updateBody = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "目标名不能为空").max(32, "目标名过长"))
      .optional(),
    icon: z.string().min(1, "图标不能为空").max(8, "图标过长").optional(),
    categoryId: z.string().min(1).nullable().optional(),
    tagId: z.string().min(1).nullable().optional(),
    direction: directionField.optional(),
    hours: z
      .number({ message: "小时数须为正数" })
      .positive("小时数须为正数")
      .max(1000, "小时数过大")
      .optional(),
    periodUnit: periodUnitField.optional(),
    dueDate: dueDateField.optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.icon !== undefined ||
      body.categoryId !== undefined ||
      body.tagId !== undefined ||
      body.direction !== undefined ||
      body.hours !== undefined ||
      body.periodUnit !== undefined ||
      body.dueDate !== undefined,
    { message: "至少提供一个字段" },
  );

function getOwnGoal(deps: Deps, userId: string, id: string) {
  const row = deps.db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .get();
  if (!row) throw new AppError(404, "NOT_FOUND", "目标不存在");
  return row;
}

/** 校验 categoryId/tagId 归属当前用户；不存在或越权一律 404（与 getOwnCategory 一致）。 */
function checkCategoryId(deps: Deps, userId: string, categoryId: string) {
  const owned = deps.db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .get();
  if (!owned) throw new AppError(404, "NOT_FOUND", "分类不存在");
}

function checkTagId(deps: Deps, userId: string, tagId: string) {
  const owned = deps.db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
    .get();
  if (!owned) throw new AppError(404, "NOT_FOUND", "标签不存在");
}

export function registerGoalRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/goals", async (req) => {
    const user = requireUser(req, deps);
    const tz = requireTz((req.query as Record<string, unknown>).tz);
    return { goals: listGoalsWithProgress(deps.db, user.id, tz, deps.now()) };
  });

  app.post("/api/goals", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(createBody, req.body);
    if (body.categoryId) checkCategoryId(deps, user.id, body.categoryId);
    if (body.tagId) checkTagId(deps, user.id, body.tagId);
    const id = newId();
    deps.db
      .insert(goals)
      .values({
        id,
        userId: user.id,
        name: body.name,
        icon: body.icon,
        categoryId: body.categoryId ?? null,
        tagId: body.tagId ?? null,
        direction: body.direction,
        hours: body.hours,
        periodUnit: body.periodUnit,
        dueDate: body.dueDate ?? null,
        createdAt: deps.now().toISOString(),
      })
      .run();
    return { id };
  });

  app.patch("/api/goals/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    getOwnGoal(deps, user.id, id);
    if (body.categoryId) checkCategoryId(deps, user.id, body.categoryId);
    if (body.tagId) checkTagId(deps, user.id, body.tagId);
    const set: {
      name?: string;
      icon?: string;
      categoryId?: string | null;
      tagId?: string | null;
      direction?: "lt" | "gt";
      hours?: number;
      periodUnit?: "day" | "week" | "month";
      dueDate?: string | null;
    } = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.icon !== undefined) set.icon = body.icon;
    if (body.categoryId !== undefined) set.categoryId = body.categoryId;
    if (body.tagId !== undefined) set.tagId = body.tagId;
    if (body.direction !== undefined) set.direction = body.direction;
    if (body.hours !== undefined) set.hours = body.hours;
    if (body.periodUnit !== undefined) set.periodUnit = body.periodUnit;
    if (body.dueDate !== undefined) set.dueDate = body.dueDate;
    deps.db
      .update(goals)
      .set(set)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .run();
    const updated = getOwnGoal(deps, user.id, id);
    return {
      id: updated.id,
      name: updated.name,
      icon: updated.icon,
      categoryId: updated.categoryId ?? null,
      tagId: updated.tagId ?? null,
      direction: updated.direction,
      hours: updated.hours,
      periodUnit: updated.periodUnit,
      dueDate: updated.dueDate ?? null,
    };
  });

  app.delete("/api/goals/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    getOwnGoal(deps, user.id, id);
    deps.db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .run();
    return { ok: true };
  });
}

/** 标签删除保护：被 goal 引用时 409 CONFLICT。 */
export function goalReferencesTag(deps: Deps, tagId: string): boolean {
  const used = deps.db
    .select({ n: count() })
    .from(goals)
    .where(eq(goals.tagId, tagId))
    .get();
  return (used?.n ?? 0) > 0;
}
