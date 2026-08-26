import fs from "node:fs";
import path from "node:path";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { AppError } from "./errors.js";
import { openDb, type Deps } from "./db.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCategoryRoutes } from "./routes/categories.js";
import { registerEntryRoutes } from "./routes/entries.js";
import { registerTimerRoutes } from "./routes/timer.js";
import { registerTodayRoutes } from "./routes/today.js";
import { registerTagRoutes } from "./routes/tags.js";

export type AppConfig = {
  dbPath: string;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  webDist?: string;
  now?: () => Date;
  logger?: boolean;
};

export async function buildApp(opts: AppConfig) {
  const { sqlite, db } = openDb(opts.dbPath);
  const deps: Deps = {
    db,
    sqlite,
    cookieSecure: opts.cookieSecure,
    sessionTtlSeconds: opts.sessionTtlSeconds,
    now: opts.now ?? (() => new Date()),
  };

  const app = Fastify({ logger: opts.logger ?? true });
  await app.register(cookie);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        error: { code: err.code, message: err.message },
      });
    }
    req.log.error(err);
    return reply.code(500).send({
      error: { code: "INTERNAL", message: "服务器错误" },
    });
  });

  registerAuthRoutes(app, deps);
  registerCategoryRoutes(app, deps);
  registerEntryRoutes(app, deps);
  registerTimerRoutes(app, deps);
  registerTodayRoutes(app, deps);
  registerTagRoutes(app, deps);

  const webDist = opts.webDist ? path.resolve(opts.webDist) : undefined;
  if (webDist && fs.existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      index: ["index.html"],
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api") || req.method !== "GET") {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "未找到" },
      });
    }
    if (webDist && fs.existsSync(path.join(webDist, "index.html"))) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send("Not Found");
  });

  app.addHook("onClose", () => {
    sqlite.close();
  });

  return app;
}
