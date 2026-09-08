import { and, eq, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { IANAZone } from "luxon";
import { z } from "zod";
import { clearSessionCookie, hashPassword, requireUser, verifyPassword } from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { sessions, users } from "../schema.js";
import { passwordSchema, usernameSchema } from "./auth.js";

const profileBody = z
  .object({
    username: usernameSchema.optional(),
    displayName: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().max(32, "昵称过长"))
      .optional(),
    // IANA 时区名；空串 = 清除（跟随浏览器），非空值需为有效 IANA 区
    timezone: z.string().max(64).optional(),
    // 无间隙计时开关（SQLite 布尔）
    continuousTiming: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.username !== undefined ||
      body.displayName !== undefined ||
      body.timezone !== undefined ||
      body.continuousTiming !== undefined,
    {
      message: "至少提供一个字段",
    },
  );

const passwordBody = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: passwordSchema,
});

const deleteBody = z.object({
  password: z.string().min(1, "密码不能为空"),
});

export function registerAccountRoutes(app: FastifyInstance, deps: Deps) {
  app.patch("/api/profile", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(profileBody, req.body);

    const updates: Partial<{
      username: string;
      displayName: string | null;
      timezone: string | null;
      continuousTiming: boolean;
    }> = {};
    if (body.username !== undefined) updates.username = body.username;
    if (body.displayName !== undefined) {
      updates.displayName = body.displayName === "" ? null : body.displayName;
    }
    if (body.timezone !== undefined) {
      if (body.timezone !== "" && !IANAZone.isValidZone(body.timezone)) {
        throw new AppError(400, "VALIDATION", "时区无效");
      }
      updates.timezone = body.timezone === "" ? null : body.timezone;
    }
    if (body.continuousTiming !== undefined) updates.continuousTiming = body.continuousTiming;

    try {
      deps.db.update(users).set(updates).where(eq(users.id, user.id)).run();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "用户名已被使用");
      }
      throw err;
    }

    const row = deps.db.select().from(users).where(eq(users.id, user.id)).get();
    if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName ?? null,
      timezone: row.timezone ?? null,
      continuousTiming: Boolean(row.continuousTiming),
    };
  });

  app.patch("/api/account/password", async (req) => {
    const user = requireUser(req, deps);
    const body = parseBody(passwordBody, req.body);

    const row = deps.db.select().from(users).where(eq(users.id, user.id)).get();
    if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
    const ok = await verifyPassword(row.passwordHash, body.currentPassword);
    if (!ok) {
      throw new AppError(401, "UNAUTHORIZED", "当前密码错误");
    }

    const passwordHash = await hashPassword(body.newPassword);
    deps.db.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();

    // Revoke all other sessions; a Bearer PAT request has no sid cookie, so
    // that revokes everything (design: PAT keeps working, PATs are unaffected).
    const sid = req.cookies.sid;
    if (sid) {
      deps.db
        .delete(sessions)
        .where(and(eq(sessions.userId, user.id), ne(sessions.id, sid)))
        .run();
    } else {
      deps.db.delete(sessions).where(eq(sessions.userId, user.id)).run();
    }

    return { ok: true };
  });

  app.delete("/api/account", async (req, reply) => {
    const user = requireUser(req, deps);
    const body = parseBody(deleteBody, req.body);

    const row = deps.db.select().from(users).where(eq(users.id, user.id)).get();
    if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
    const ok = await verifyPassword(row.passwordHash, body.password);
    if (!ok) {
      throw new AppError(401, "UNAUTHORIZED", "密码错误");
    }

    deps.db.delete(users).where(eq(users.id, user.id)).run(); // FK cascades clean the rest
    clearSessionCookie(reply, deps);
    return { ok: true };
  });

  app.get("/api/meta", async () => {
    return { registrationOpen: deps.registrationOpen };
  });
}