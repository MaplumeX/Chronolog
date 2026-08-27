import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashToken, newId, newToken, requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, parseBody } from "../errors.js";
import { apiTokens } from "../schema.js";

const nameBody = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "名称不能为空").max(64, "名称过长")),
});

export function registerTokenRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/tokens", async (req) => {
    const user = requireUser(req, deps);
    const rows = deps.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .orderBy(sql`rowid`)
      .all();
    return {
      tokens: rows.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
      })),
    };
  });

  app.post("/api/tokens", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(nameBody, req.body);
    const id = newId();
    const token = newToken();
    const createdAt = deps.now().toISOString();
    deps.db
      .insert(apiTokens)
      .values({
        id,
        userId: user.id,
        name: body.name,
        tokenHash: hashToken(token),
        createdAt,
      })
      .run();
    return { id, name: body.name, token, createdAt };
  });

  app.delete("/api/tokens/:id", async (req) => {
    const user = requireUser(req, deps);
    const { id } = parseBody(z.object({ id: z.string().min(1) }), req.params);
    const row = deps.db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
      .get();
    if (!row) throw new AppError(404, "NOT_FOUND", "Token 不存在");
    deps.db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id))).run();
    return { ok: true };
  });
}