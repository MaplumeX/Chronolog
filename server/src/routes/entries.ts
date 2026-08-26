import { and, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { getEntry } from "../entries.js";
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

function updateOnce(
  deps: Deps,
  userId: string,
  id: string,
  body: z.infer<typeof updateBody>,
) {
  deps.db.transaction((tx) => {
    const entry = tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .get();
    if (!entry) throw new AppError(404, "NOT_FOUND", "条目不存在");
    if (!entry.stoppedAt) throw new AppError(409, "CONFLICT", "运行中的条目不可编辑");

    const cat = tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
      .get();
    if (!cat) throw new AppError(404, "NOT_FOUND", "分类不存在");

    if (body.tagIds.length > 0) {
      const owned = tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, body.tagIds)))
        .all();
      if (owned.length !== body.tagIds.length) {
        throw new AppError(404, "NOT_FOUND", "标签不存在");
      }
    }

    if (body.stoppedAt <= body.startedAt) {
      throw new AppError(400, "VALIDATION", "结束时间必须晚于开始时间");
    }

    // 半开区间 [start, end) 重叠校验：边界相接（前一条结束 == 后一条开始）不算重叠。
    // 运行中条目（stoppedAt IS NULL）视为延伸到无穷，参与冲突检测。
    const overlap = tx
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          ne(timeEntries.id, id),
          lt(timeEntries.startedAt, body.stoppedAt),
          or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, body.startedAt)),
        ),
      )
      .get();
    if (overlap) throw new AppError(409, "OVERLAP", "该时间段与其它条目重叠");

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

export function registerEntryRoutes(app: FastifyInstance, deps: Deps) {
  app.patch("/api/entries/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const body = parseBody(updateBody, req.body);
    const tagIds = [...new Set(body.tagIds)];
    updateOnce(deps, user.id, id, { ...body, tagIds });
    const entry = getEntry(deps.db, user.id, id, deps.now());
    return { entry };
  });
}
