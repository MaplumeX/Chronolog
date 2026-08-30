import { and, count, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { entryTags, tags } from "../schema.js";

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
    .pipe(z.string().min(1, "标签名不能为空").max(32, "标签名过长")),
  color: colorField,
});

const updateBody = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "标签名不能为空").max(32, "标签名过长"))
      .optional(),
    color: colorField,
  })
  .refine((body) => body.name !== undefined || body.color !== undefined, {
    message: "至少提供一个字段",
  });

function getOwnTag(deps: Deps, userId: string, id: string) {
  const row = deps.db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .get();
  if (!row) throw new AppError(404, "NOT_FOUND", "标签不存在");
  return row;
}

export function registerTagRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/tags", async (req) => {
    const user = requireUser(req, deps);
    const rows = deps.db
      .select()
      .from(tags)
      .where(eq(tags.userId, user.id))
      .orderBy(sql`rowid`)
      .all();
    const counts = deps.db
      .select({
        tagId: entryTags.tagId,
        n: count(),
      })
      .from(entryTags)
      .groupBy(entryTags.tagId)
      .all();
    const byId = new Map(counts.map((c) => [c.tagId, c.n]));
    return {
      tags: rows.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color ?? null,
        entryCount: byId.get(t.id) ?? 0,
      })),
    };
  });

  app.post("/api/tags", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(createBody, req.body);
    const id = newId();
    try {
      deps.db
        .insert(tags)
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
        throw new AppError(409, "CONFLICT", "标签名已存在");
      }
      throw err;
    }
    return { id, name: body.name, color: body.color ?? null, entryCount: 0 };
  });

  app.patch("/api/tags/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    getOwnTag(deps, user.id, id);
    const set: { name?: string; color?: number | null } = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.color !== undefined) set.color = body.color;
    try {
      deps.db
        .update(tags)
        .set(set)
        .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "标签名已存在");
      }
      throw err;
    }
    const updated = getOwnTag(deps, user.id, id);
    return { id: updated.id, name: updated.name, color: updated.color ?? null };
  });

  app.delete("/api/tags/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    getOwnTag(deps, user.id, id);
    deps.db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
      .run();
    return { ok: true };
  });
}
