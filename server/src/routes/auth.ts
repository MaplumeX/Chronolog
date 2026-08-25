import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  clearSessionCookie,
  hashPassword,
  loadUser,
  newId,
  replaceSession,
  setSessionCookie,
  verifyPassword,
} from "../auth.js";
import type { Deps } from "../db.js";
import { AppError, isUniqueViolation, parseBody } from "../errors.js";
import { DEFAULT_CATEGORIES, categories, sessions, users } from "../schema.js";

const credentials = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,32}$/, "用户名须为 3–32 个字母、数字或下划线"),
  password: z.string().min(8, "密码至少 8 个字符").max(256, "密码过长"),
});

export function registerAuthRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/api/auth/register", async (req, reply) => {
    const body = parseBody(credentials, req.body);
    const nowIso = deps.now().toISOString();
    const userId = newId();
    const passwordHash = await hashPassword(body.password);

    try {
      deps.db.transaction((tx) => {
        tx.insert(users)
          .values({
            id: userId,
            username: body.username,
            passwordHash,
            createdAt: nowIso,
          })
          .run();
        tx.insert(categories)
          .values(
            DEFAULT_CATEGORIES.map((name) => ({
              id: newId(),
              userId,
              name,
              createdAt: nowIso,
            })),
          )
          .run();
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "用户名已被使用");
      }
      throw err;
    }

    const sid = replaceSession(deps, req, userId);
    setSessionCookie(reply, sid, deps);
    return { id: userId, username: body.username };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = parseBody(credentials, req.body);
    const user = deps.db.select().from(users).where(eq(users.username, body.username)).get();
    const ok = user ? await verifyPassword(user.passwordHash, body.password) : false;
    if (!user || !ok) {
      throw new AppError(401, "UNAUTHORIZED", "用户名或密码错误");
    }
    const sid = replaceSession(deps, req, user.id);
    setSessionCookie(reply, sid, deps);
    return { id: user.id, username: user.username };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const sid = req.cookies.sid;
    if (sid) {
      deps.db.delete(sessions).where(eq(sessions.id, sid)).run();
    }
    clearSessionCookie(reply, deps);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    const user = loadUser(req, deps);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "请先登录");
    }
    return user;
  });
}
