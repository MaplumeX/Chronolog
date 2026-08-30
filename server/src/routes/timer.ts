import { and, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { getEntry, getRunningEntry } from "../entries.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { categories, entryTags, tags, timeEntries } from "../schema.js";

const startBody = z.object({
  categoryId: z.string().min(1, "请选择分类"),
  description: z.string().max(200, "说明过长").optional(),
  tagIds: z.array(z.string().min(1)).optional(),
});

// 运行中条目只允许编辑说明/分类/标签；strict 拒绝 startedAt/stoppedAt 等多余字段
const updateCurrentBody = z.strictObject({
  description: z.string().max(200, "说明过长").optional(),
  categoryId: z.string().min(1, "请选择分类").optional(),
  tagIds: z.array(z.string().min(1)).optional(),
});

type UpdateCurrentBody = z.infer<typeof updateCurrentBody>;

/** 更新运行中条目的说明/分类/标签（不改时间）；返回运行中条目 id。 */
function updateRunningOnce(deps: Deps, userId: string, body: UpdateCurrentBody): string {
  return deps.db.transaction((tx) => {
    const running = tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .get();
    if (!running) throw new AppError(409, "CONFLICT", "当前没有正在运行的计时");

    if (body.categoryId !== undefined) {
      const cat = tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
        .get();
      if (!cat) throw new AppError(404, "NOT_FOUND", "分类不存在");
    }

    if (body.tagIds !== undefined && body.tagIds.length > 0) {
      const owned = tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, body.tagIds)))
        .all();
      if (owned.length !== body.tagIds.length) {
        throw new AppError(404, "NOT_FOUND", "标签不存在");
      }
    }

    const set: { description?: string; categoryId?: string } = {};
    if (body.description !== undefined) set.description = body.description.trim();
    if (body.categoryId !== undefined) set.categoryId = body.categoryId;
    if (set.description !== undefined || set.categoryId !== undefined) {
      tx.update(timeEntries).set(set).where(eq(timeEntries.id, running.id)).run();
    }

    if (body.tagIds !== undefined) {
      tx.delete(entryTags).where(eq(entryTags.entryId, running.id)).run();
      if (body.tagIds.length > 0) {
        tx.insert(entryTags)
          .values(body.tagIds.map((tagId) => ({ entryId: running.id, tagId })))
          .run();
      }
    }
    return running.id;
  });
}

function startOnce(
  deps: Deps,
  userId: string,
  categoryId: string,
  description: string,
  tagIds: string[],
  nowIso: string,
) {
  let createdId = "";
  deps.db.transaction((tx) => {
    const cat = tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .get();
    if (!cat) throw new AppError(404, "NOT_FOUND", "分类不存在");

    if (tagIds.length > 0) {
      const owned = tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)))
        .all();
      if (owned.length !== tagIds.length) {
        throw new AppError(404, "NOT_FOUND", "标签不存在");
      }
    }

    const running = tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .get();
    if (running) {
      tx.update(timeEntries)
        .set({ stoppedAt: nowIso })
        .where(eq(timeEntries.id, running.id))
        .run();
    }
    createdId = newId();
    tx.insert(timeEntries)
      .values({
        id: createdId,
        userId,
        categoryId,
        description,
        startedAt: nowIso,
        stoppedAt: null,
      })
      .run();
    if (tagIds.length > 0) {
      tx.insert(entryTags)
        .values(tagIds.map((tagId) => ({ entryId: createdId, tagId })))
        .run();
    }
  });
  return createdId;
}

export function registerTimerRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/timer/current", async (req) => {
    const user = requireUser(req, deps);
    return { entry: getRunningEntry(deps.db, user.id, deps.now()) };
  });

  app.post("/api/timer/start", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(startBody, req.body);
    const description = (body.description ?? "").trim();
    const tagIds = [...new Set(body.tagIds ?? [])];
    const nowIso = deps.now().toISOString();

    let createdId: string;
    try {
      createdId = startOnce(deps, user.id, body.categoryId, description, tagIds, nowIso);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      createdId = startOnce(deps, user.id, body.categoryId, description, tagIds, nowIso);
    }

    const entry = getEntry(deps.db, user.id, createdId, deps.now());
    return { entry };
  });

  app.patch("/api/timer/current", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(updateCurrentBody, req.body);
    const tagIds = body.tagIds !== undefined ? [...new Set(body.tagIds)] : undefined;
    const id = updateRunningOnce(deps, user.id, { ...body, tagIds });
    return { entry: getEntry(deps.db, user.id, id, deps.now()) };
  });

  app.post("/api/timer/stop", async (req) => {
    const user = requireUser(req, deps);
    const nowIso = deps.now().toISOString();
    const running = deps.db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.stoppedAt)))
      .get();
    if (!running) {
      throw new AppError(409, "CONFLICT", "当前没有正在运行的计时");
    }
    deps.db
      .update(timeEntries)
      .set({ stoppedAt: nowIso })
      .where(eq(timeEntries.id, running.id))
      .run();
    return { entry: getEntry(deps.db, user.id, running.id, deps.now()) };
  });
}
