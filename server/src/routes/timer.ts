import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { newId, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { getEntry, getRunningEntry } from "../entries.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { categories, timeEntries } from "../schema.js";

const startBody = z.object({
  categoryId: z.string().min(1, "请选择分类"),
  description: z.string().max(200, "说明过长").optional(),
});

function startOnce(deps: Deps, userId: string, categoryId: string, description: string, nowIso: string) {
  let createdId = "";
  deps.db.transaction((tx) => {
    const cat = tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .get();
    if (!cat) throw new AppError(404, "NOT_FOUND", "分类不存在");

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
    const nowIso = deps.now().toISOString();

    let createdId: string;
    try {
      createdId = startOnce(deps, user.id, body.categoryId, description, nowIso);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      createdId = startOnce(deps, user.id, body.categoryId, description, nowIso);
    }

    const entry = getEntry(deps.db, user.id, createdId, deps.now());
    return { entry };
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
