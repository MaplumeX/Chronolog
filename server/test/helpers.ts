import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../src/app.js";

export type TestApp = {
  app: FastifyInstance;
  dbPath: string;
  dir: string;
  close: () => Promise<void>;
};

export async function createTestApp(opts?: {
  now?: () => Date;
  dbPath?: string;
  keepDir?: boolean;
}): Promise<TestApp> {
  const dir = opts?.dbPath
    ? path.dirname(opts.dbPath)
    : fs.mkdtempSync(path.join(os.tmpdir(), "chronolog-"));
  const dbPath = opts?.dbPath ?? path.join(dir, "test.db");
  const app = await buildApp({
    dbPath,
    cookieSecure: false,
    sessionTtlSeconds: 604800,
    now: opts?.now ?? (() => new Date()),
    logger: false,
  });
  return {
    app,
    dbPath,
    dir,
    async close() {
      await app.close();
      if (!opts?.keepDir) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function sidOf(res: LightMyRequestResponse): string {
  const cookie = res.cookies.find((c) => c.name === "sid");
  if (!cookie) throw new Error("missing sid cookie");
  return cookie.value;
}

export function cookieHeader(sid: string) {
  return { cookie: `sid=${sid}` };
}

export async function registerUser(
  app: FastifyInstance,
  username: string,
  password = "password1",
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { username, password },
  });
  return { res, sid: res.statusCode < 400 ? sidOf(res) : "" };
}

export function json(res: LightMyRequestResponse) {
  return res.json() as Record<string, unknown>;
}
