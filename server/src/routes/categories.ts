import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { categories, goals, timeEntries } from "../schema.js";

const colorField = z
  .number({ message: "颜色须为 1–8 的整数" })
  .int("颜色须为 1–8 的整数")
  .min(1, "颜色须为 1–8 的整数")
  .max(8, "颜色须为 1–8 的整数")
  .nullable()
  .optional();

const parentIdField = z.string().min(1, "父级分类无效").nullable().optional();

const createBody = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "分类名不能为空").max(32, "分类名过长")),
  color: colorField,
  parentId: parentIdField,
});

const updateBody = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "分类名不能为空").max(32, "分类名过长"))
      .optional(),
    color: colorField,
    parentId: parentIdField,
  })
  .refine((body) => body.name !== undefined || body.color !== undefined || body.parentId !== undefined, {
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

/** 指定父级必须存在、属于当前用户、为顶层节点（层级最多两级）且未归档。返回该父级行。 */
function requireValidParent(deps: Deps, userId: string, parentId: string) {
  const parent = getOwnCategory(deps, userId, parentId);
  if (parent.parentId !== null) {
    throw new AppError(409, "CONFLICT", "层级最多两级");
  }
  if (parent.archivedAt !== null) {
    throw new AppError(409, "CONFLICT", "归档分类不能作为父级");
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
    eq(categories.userId, userId),
    parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId),
    eq(categories.name, name),
  ];
  if (excludeId !== undefined) conditions.push(sql`${categories.id} <> ${excludeId}`);
  const dup = deps.db
    .select({ id: categories.id })
    .from(categories)
    .where(and(...conditions))
    .get();
  if (dup) throw new AppError(409, "CONFLICT", "分类名已存在");
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
        parentId: c.parentId ?? null,
        archivedAt: c.archivedAt ?? null,
        entryCount: byId.get(c.id) ?? 0,
      })),
    };
  });

  app.post("/api/categories", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(createBody, req.body);
    const parentId = body.parentId ?? null;
    if (parentId !== null) requireValidParent(deps, user.id, parentId);
    assertNameAvailable(deps, user.id, parentId, body.name);
    const id = newId();
    try {
      deps.db
        .insert(categories)
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
        throw new AppError(409, "CONFLICT", "分类名已存在");
      }
      throw err;
    }
    return { id, name: body.name, color: body.color ?? null, parentId, archivedAt: null, entryCount: 0 };
  });

  app.patch("/api/categories/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    const existing = getOwnCategory(deps, user.id, id);

    // 新父级：undefined = 保持现状；null = 提升为顶层；否则须为合法顶层节点
    const parentId = body.parentId === undefined ? existing.parentId : body.parentId;
    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = requireValidParent(deps, user.id, body.parentId);
      if (parent.id === id) {
        throw new AppError(409, "CONFLICT", "不能将分类设为自身的子级");
      }
      // 已有子节点的节点必须是顶层（挂到父级下会形成三级）
      const childCount = deps.db
        .select({ n: count() })
        .from(categories)
        .where(and(eq(categories.parentId, id), eq(categories.userId, user.id)))
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
    return { id: updated.id, name: updated.name, color: updated.color ?? null, parentId: updated.parentId ?? null, archivedAt: updated.archivedAt ?? null };
  });

  app.post("/api/categories/:id/archive", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const existing = getOwnCategory(deps, user.id, id);
    const archivedAt = deps.now().toISOString();
    deps.db.transaction((tx) => {
      // 顶层节点：整体归档，所有子分类一并刷新时间戳（含已归档子级，幂等）；子分类：仅自身
      tx.update(categories)
        .set({ archivedAt })
        .where(
          and(
            eq(categories.userId, user.id),
            existing.parentId === null
              ? or(eq(categories.id, id), eq(categories.parentId, id))
              : eq(categories.id, id),
          ),
        )
        .run();
    });
    const updated = getOwnCategory(deps, user.id, id);
    return { id: updated.id, name: updated.name, color: updated.color ?? null, parentId: updated.parentId ?? null, archivedAt: updated.archivedAt ?? null };
  });

  app.post("/api/categories/:id/unarchive", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const existing = getOwnCategory(deps, user.id, id);
    deps.db.transaction((tx) => {
      // 目标自身 + 沿 parentId 链向上级联恢复归档祖先链；不触碰兄弟/子孙
      let node: { id: string; parentId: string | null } | undefined = existing;
      while (node) {
        tx.update(categories)
          .set({ archivedAt: null })
          .where(and(eq(categories.id, node.id), eq(categories.userId, user.id)))
          .run();
        node = node.parentId
          ? tx
              .select({ id: categories.id, parentId: categories.parentId })
              .from(categories)
              .where(and(eq(categories.id, node.parentId), eq(categories.userId, user.id)))
              .get()
          : undefined;
      }
    });
    const updated = getOwnCategory(deps, user.id, id);
    return { id: updated.id, name: updated.name, color: updated.color ?? null, parentId: updated.parentId ?? null, archivedAt: updated.archivedAt ?? null };
  });

  app.delete("/api/categories/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    getOwnCategory(deps, user.id, id);
    const children = deps.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.parentId, id), eq(categories.userId, user.id)))
      .all();
    const ids = [id, ...children.map((c) => c.id)];
    // 删除放宽：不再要求无时间记录/无 goal 引用；相关引用置 NULL（未分类），运行中计时器继续运行
    deps.db.transaction((tx) => {
      for (const targetId of ids) {
        tx.update(timeEntries)
          .set({ categoryId: null })
          .where(and(eq(timeEntries.categoryId, targetId), eq(timeEntries.userId, user.id)))
          .run();
        tx.update(goals)
          .set({ categoryId: null })
          .where(and(eq(goals.categoryId, targetId), eq(goals.userId, user.id)))
          .run();
      }
      for (const targetId of ids) {
        tx.delete(categories)
          .where(and(eq(categories.id, targetId), eq(categories.userId, user.id)))
          .run();
      }
    });
    return { ok: true };
  });
}
