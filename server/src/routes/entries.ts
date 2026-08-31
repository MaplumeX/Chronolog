import { and, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Db, Deps } from "../db.js";
import { getEntry, listBoundary } from "../entries.js";
import { requireTz } from "../time.js";
import { AppError, parseBody } from "../errors.js";
import { categories, entryTags, tags, timeEntries } from "../schema.js";

const updateBody = z.object({
  description: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(200, "说明过长")),
  categoryId: z.string().min(1, "请选择分类"),
  tagIds: z.array(z.string().min(1)),
  startedAt: z.iso.datetime("时间格式无效"),
  stoppedAt: z.iso.datetime("时间格式无效"),
});

type UpsertBody = z.infer<typeof updateBody>;

function checkTimeOrder(body: UpsertBody) {
  if (body.stoppedAt <= body.startedAt) {
    throw new AppError(400, "VALIDATION", "结束时间必须晚于开始时间");
  }
}

function checkCategory(tx: Db, userId: string, categoryId: string) {
  const cat = tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .get();
  if (!cat) throw new AppError(404, "NOT_FOUND", "分类不存在");
}

function checkTags(tx: Db, userId: string, tagIds: string[]) {
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
}

// 半开区间 [start, end) 重叠校验：边界相接（前一条结束 == 后一条开始）不算重叠。
// 运行中条目（stoppedAt IS NULL）视为延伸到无穷，参与冲突检测。
function checkOverlap(tx: Db, userId: string, startedAt: string, stoppedAt: string, excludeId?: string) {
  const overlap = tx
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        excludeId !== undefined ? ne(timeEntries.id, excludeId) : undefined,
        lt(timeEntries.startedAt, stoppedAt),
        or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, startedAt)),
      ),
    )
    .get();
  if (overlap) throw new AppError(409, "OVERLAP", "该时间段与其它条目重叠");
}

function updateOnce(deps: Deps, userId: string, id: string, body: UpsertBody) {
  deps.db.transaction((tx) => {
    const entry = tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .get();
    if (!entry) throw new AppError(404, "NOT_FOUND", "条目不存在");
    if (!entry.stoppedAt) throw new AppError(409, "CONFLICT", "运行中的条目不可编辑");

    checkCategory(tx, userId, body.categoryId);
    checkTags(tx, userId, body.tagIds);
    checkTimeOrder(body);
    checkOverlap(tx, userId, body.startedAt, body.stoppedAt, id);

    tx.update(timeEntries)
      .set({
        description: body.description,
        categoryId: body.categoryId,
        startedAt: body.startedAt,
        stoppedAt: body.stoppedAt,
      })
      .where(eq(timeEntries.id, id))
      .run();

    tx.delete(entryTags).where(eq(entryTags.entryId, id)).run();
    if (body.tagIds.length > 0) {
      tx.insert(entryTags)
        .values(body.tagIds.map((tagId) => ({ entryId: id, tagId })))
        .run();
    }
  });
}

function createOnce(deps: Deps, userId: string, body: UpsertBody): string {
  return deps.db.transaction((tx) => {
    checkTimeOrder(body);
    checkCategory(tx, userId, body.categoryId);
    checkTags(tx, userId, body.tagIds);
    checkOverlap(tx, userId, body.startedAt, body.stoppedAt);

    const id = newId();
    tx.insert(timeEntries)
      .values({
        id,
        userId,
        categoryId: body.categoryId,
        description: body.description,
        startedAt: body.startedAt,
        stoppedAt: body.stoppedAt,
      })
      .run();
    if (body.tagIds.length > 0) {
      tx.insert(entryTags)
        .values(body.tagIds.map((tagId) => ({ entryId: id, tagId })))
        .run();
    }
    return id;
  });
}

// 删除：仅所有者 + 已停止条目可删；entry_tags 由 ON DELETE CASCADE 自动清理。
function deleteOnce(deps: Deps, userId: string, id: string) {
  deps.db.transaction((tx) => {
    const entry = tx
      .select({ id: timeEntries.id, stoppedAt: timeEntries.stoppedAt })
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .get();
    if (!entry) throw new AppError(404, "NOT_FOUND", "条目不存在");
    if (!entry.stoppedAt) throw new AppError(409, "CONFLICT", "运行中的条目不可删除");
    tx.delete(timeEntries).where(eq(timeEntries.id, id)).run();
  });
}

const boundaryQuery = z.object({
  tz: z.string().min(1, "时区无效"),
  start: z.iso.datetime("时间格式无效"),
  end: z.iso.datetime("时间格式无效"),
});

export function registerEntryRoutes(app: FastifyInstance, deps: Deps) {
  // 查询窗口紧邻外侧的条目（前端 gap 插槽边界）：start/end 为 ISO 时刻，tz 仅做校验
  app.get("/api/entries/boundary", async (req) => {
    const user = requireUser(req, deps);
    const q = parseBody(boundaryQuery, req.query);
    const tz = requireTz(q.tz);
    if (q.end <= q.start) {
      throw new AppError(400, "VALIDATION", "结束时间必须晚于开始时间");
    }
    return listBoundary(deps.db, user.id, tz, q.start, q.end, deps.now());
  });

  app.patch("/api/entries/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    const tagIds = [...new Set(body.tagIds)];
    updateOnce(deps, user.id, id, { ...body, tagIds });
    const entry = getEntry(deps.db, user.id, id, deps.now());
    return { entry };
  });

  app.post("/api/entries", async (req, reply) => {
    const user = requireUser(req, deps);
    const body = parseBody(updateBody, req.body);
    const tagIds = [...new Set(body.tagIds)];
    const id = createOnce(deps, user.id, { ...body, tagIds });
    const entry = getEntry(deps.db, user.id, id, deps.now());
    reply.code(201);
    return { entry };
  });

  app.delete("/api/entries/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    deleteOnce(deps, user.id, id);
    return { ok: true };
  });
}
