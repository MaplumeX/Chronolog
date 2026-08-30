import { and, count, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { goalReferencesCategory } from "./goals.js";
import { categories, timeEntries } from "../schema.js";

const colorField = z
  .number({ message: "颜色须为 1–8 的整数" })
  .int("颜色须为 1–8 的整数")
  .min(1, "颜色须为 1–8 的整数")
  .max(8, "颜色须为 1–8 的整数")
  .nullable()
  .optional();

const createBody = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "分类名不能为空").max(32, "分类名过长")),
  color: colorField,
});

const updateBody = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "分类名不能为空").max(32, "分类名过长"))
      .optional(),
    color: colorField,
  })
  .refine((body) => body.name !== undefined || body.color !== undefined, {
    message: "至少提供一个字段",
  });

function getOwnCategory(deps: Deps, userId: string, id: string) {
  const row = deps.db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .get();
  if (!row) throw new AppError(404, "NOT_FOUND", "分类不存在");
  return row;
}

export function registerCategoryRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/categories", async (req) => {
    const user = requireUser(req, deps);
    const rows = deps.db
      .select()
      .from(categories)
      .where(eq(categories.userId, user.id))
      .orderBy(sql`rowid`)
      .all();
    const counts = deps.db
      .select({
        categoryId: timeEntries.categoryId,
        n: count(),
      })
      .from(timeEntries)
      .where(eq(timeEntries.userId, user.id))
      .groupBy(timeEntries.categoryId)
      .all();
    const byId = new Map(counts.map((c) => [c.categoryId, c.n]));
    return {
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color ?? null,
        entryCount: byId.get(c.id) ?? 0,
      })),
    };
  });

  app.post("/api/categories", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(createBody, req.body);
    const id = newId();
    try {
      deps.db
        .insert(categories)
        .values({
          id,
          userId: user.id,
          name: body.name,
          color: body.color ?? null,
          createdAt: deps.now().toISOString(),
        })
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "分类名已存在");
      }
      throw err;
    }
    return { id, name: body.name, color: body.color ?? null, entryCount: 0 };
  });

  app.patch("/api/categories/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    getOwnCategory(deps, user.id, id);
    const set: { name?: string; color?: number | null } = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.color !== undefined) set.color = body.color;
    try {
      deps.db
        .update(categories)
        .set(set)
        .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "分类名已存在");
      }
      throw err;
    }
    const updated = getOwnCategory(deps, user.id, id);
    return { id: updated.id, name: updated.name, color: updated.color ?? null };
  });

  app.delete("/api/categories/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    getOwnCategory(deps, user.id, id);
    const used = deps.db
      .select({ n: count() })
      .from(timeEntries)
      .where(and(eq(timeEntries.categoryId, id), eq(timeEntries.userId, user.id)))
      .get();
    if ((used?.n ?? 0) > 0) {
      throw new AppError(409, "CONFLICT", "该分类仍有时间记录，无法删除");
    }
    if (goalReferencesCategory(deps, id)) {
      throw new AppError(409, "CONFLICT", "该分类已被目标引用");
    }
    deps.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .run();
    return { ok: true };
  });
}
