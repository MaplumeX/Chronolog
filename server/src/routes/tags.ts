import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { goalReferencesTag } from "./goals.js";
import { entryTags, tags } from "../schema.js";

const colorField = z
  .number({ message: "颜色须为 1–8 的整数" })
  .int("颜色须为 1–8 的整数")
  .min(1, "颜色须为 1–8 的整数")
  .max(8, "颜色须为 1–8 的整数")
  .nullable()
  .optional();

const parentIdField = z.string().min(1, "父级标签无效").nullable().optional();

const createBody = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "标签名不能为空").max(32, "标签名过长")),
  color: colorField,
  parentId: parentIdField,
});

const updateBody = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "标签名不能为空").max(32, "标签名过长"))
      .optional(),
    color: colorField,
    parentId: parentIdField,
  })
  .refine((body) => body.name !== undefined || body.color !== undefined || body.parentId !== undefined, {
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

/** 指定父级必须存在、属于当前用户且为顶层节点（层级最多两级）。返回该父级行。 */
function requireValidParent(deps: Deps, userId: string, parentId: string) {
  const parent = getOwnTag(deps, userId, parentId);
  if (parent.parentId !== null) {
    throw new AppError(409, "CONFLICT", "层级最多两级");
  }
  return parent;
}

/** 同父级下重名检查（parentId 为 null 表示顶层范围）。excludeId 用于改名时排除自身。 */
function assertNameAvailable(
  deps: Deps,
  userId: string,
  parentId: string | null,
  name: string,
  excludeId?: string,
) {
  const conditions = [
    eq(tags.userId, userId),
    parentId === null ? isNull(tags.parentId) : eq(tags.parentId, parentId),
    eq(tags.name, name),
  ];
  if (excludeId !== undefined) conditions.push(sql`${tags.id} <> ${excludeId}`);
  const dup = deps.db
    .select({ id: tags.id })
    .from(tags)
    .where(and(...conditions))
    .get();
  if (dup) throw new AppError(409, "CONFLICT", "标签名已存在");
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
        parentId: t.parentId ?? null,
        entryCount: byId.get(t.id) ?? 0,
      })),
    };
  });

  app.post("/api/tags", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(createBody, req.body);
    const parentId = body.parentId ?? null;
    if (parentId !== null) requireValidParent(deps, user.id, parentId);
    assertNameAvailable(deps, user.id, parentId, body.name);
    const id = newId();
    try {
      deps.db
        .insert(tags)
        .values({
          id,
          userId: user.id,
          name: body.name,
          color: body.color ?? null,
          parentId,
          createdAt: deps.now().toISOString(),
        })
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "标签名已存在");
      }
      throw err;
    }
    return { id, name: body.name, color: body.color ?? null, parentId, entryCount: 0 };
  });

  app.patch("/api/tags/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    const existing = getOwnTag(deps, user.id, id);

    // 新父级：undefined = 保持现状；null = 提升为顶层；否则须为合法顶层节点
    const parentId = body.parentId === undefined ? existing.parentId : body.parentId;
    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = requireValidParent(deps, user.id, body.parentId);
      if (parent.id === id) {
        throw new AppError(409, "CONFLICT", "不能将标签设为自身的子级");
      }
      // 已有子节点的节点必须是顶层（挂到父级下会形成三级）
      const childCount = deps.db
        .select({ n: count() })
        .from(tags)
        .where(and(eq(tags.parentId, id), eq(tags.userId, user.id)))
        .get();
      if ((childCount?.n ?? 0) > 0) {
        throw new AppError(409, "CONFLICT", "层级最多两级");
      }
    }

    const name = body.name ?? existing.name;
    assertNameAvailable(deps, user.id, parentId, name, id);

    const set: { name?: string; color?: number | null; parentId?: string | null } = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.color !== undefined) set.color = body.color;
    if (body.parentId !== undefined) set.parentId = body.parentId;
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
    return { id: updated.id, name: updated.name, color: updated.color ?? null, parentId: updated.parentId ?? null };
  });

  app.delete("/api/tags/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    getOwnTag(deps, user.id, id);
    // 级联删除：父级与其所有子标签都必须无 goal 引用（entry_tags 由 ON DELETE CASCADE 自然处理）
    const children = deps.db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.parentId, id), eq(tags.userId, user.id)))
      .all();
    const ids = [id, ...children.map((c) => c.id)];
    for (const targetId of ids) {
      if (goalReferencesTag(deps, targetId)) {
        throw new AppError(409, "CONFLICT", "该标签已被目标引用");
      }
    }
    deps.db.transaction((tx) => {
      for (const targetId of ids) {
        tx.delete(tags)
          .where(and(eq(tags.id, targetId), eq(tags.userId, user.id)))
          .run();
      }
    });
    return { ok: true };
  });
}
