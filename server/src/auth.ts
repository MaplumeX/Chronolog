import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Deps } from "./db.js";
import { AppError } from "./errors.js";
import { apiTokens, sessions, users } from "./schema.js";

const COOKIE = "sid";

const ARGON2 = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function newId(): string {
  return randomUUID();
}

export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/** Personal access token for non-browser clients (CLI / agents). */
export function newToken(): string {
  return `ctt_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function cookieOpts(deps: Deps) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: deps.cookieSecure,
    maxAge: deps.sessionTtlSeconds,
  };
}

export function setSessionCookie(reply: FastifyReply, sid: string, deps: Deps) {
  reply.setCookie(COOKIE, sid, cookieOpts(deps));
}

export function clearSessionCookie(reply: FastifyReply, deps: Deps) {
  reply.clearCookie(COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: deps.cookieSecure,
  });
}

export function createSession(deps: Deps, userId: string): string {
  const now = deps.now();
  const sid = newSessionId();
  const expires = new Date(now.getTime() + deps.sessionTtlSeconds * 1000);
  deps.db.insert(sessions).values({
    id: sid,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  }).run();
  return sid;
}

/** Replace the browser's current session id (login/register session fixation). */
export function replaceSession(deps: Deps, req: FastifyRequest, userId: string): string {
  const prev = req.cookies.sid;
  if (prev) {
    deps.db.delete(sessions).where(eq(sessions.id, prev)).run();
  }
  return createSession(deps, userId);
}

export type AuthUser = { id: string; username: string };

export function loadUser(req: FastifyRequest, deps: Deps): AuthUser | null {
  // Bearer token branch: only when the client sends an Authorization header
  // (browser requests carry no header and pay zero extra cost).
  const auth = req.headers.authorization;
  if (auth) {
    const [scheme, token] = auth.split(" ", 2);
    if (scheme?.toLowerCase() !== "bearer" || !token) return null;
    const row = deps.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, hashToken(token)))
      .get();
    if (!row) return null;
    deps.db
      .update(apiTokens)
      .set({ lastUsedAt: deps.now().toISOString() })
      .where(eq(apiTokens.id, row.id))
      .run();
    const tokenUser = deps.db.select().from(users).where(eq(users.id, row.userId)).get();
    if (!tokenUser) return null;
    return { id: tokenUser.id, username: tokenUser.username };
  }

  const sid = req.cookies.sid;
  if (!sid) return null;
  const row = deps.db.select().from(sessions).where(eq(sessions.id, sid)).get();
  if (!row) return null;
  if (row.expiresAt <= deps.now().toISOString()) {
    deps.db.delete(sessions).where(eq(sessions.id, sid)).run();
    return null;
  }
  const user = deps.db.select().from(users).where(eq(users.id, row.userId)).get();
  if (!user) return null;
  return { id: user.id, username: user.username };
}

export function requireUser(req: FastifyRequest, deps: Deps): AuthUser {
  const user = loadUser(req, deps);
  if (!user) throw new AppError(401, "UNAUTHORIZED", "请先登录");
  return user;
}
