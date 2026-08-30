import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { listToday, listWeek, statsRange, statsToday } from "../entries.js";
import { requireDate, requireTz } from "../time.js";

function tzQuery(query: unknown): unknown {
  if (query && typeof query === "object" && "tz" in query) {
    return (query as { tz: unknown }).tz;
  }
  return undefined;
}

function dateQuery(query: unknown, tz: string): string | undefined {
  if (query && typeof query === "object" && "date" in query) {
    return requireDate((query as { date: unknown }).date, tz);
  }
  return undefined;
}

function stringQuery(query: unknown, key: string): string | undefined {
  if (query && typeof query === "object" && key in query) {
    const v = (query as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function tagIdQuery(query: unknown): string | undefined {
  return stringQuery(query, "tagId");
}

function rollupQuery(query: unknown): boolean {
  const v = stringQuery(query, "rollup");
  return v === "true" || v === "1";
}

export function registerTodayRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/entries/today", async (req) => {
    const user = requireUser(req, deps);
    const tz = requireTz(tzQuery(req.query));
    const date = dateQuery(req.query, tz);
    return listToday(deps.db, user.id, tz, deps.now(), tagIdQuery(req.query), date);
  });

  app.get("/api/entries/week", async (req) => {
    const user = requireUser(req, deps);
    const tz = requireTz(tzQuery(req.query));
    const date = dateQuery(req.query, tz);
    return listWeek(deps.db, user.id, tz, deps.now(), date);
  });

  app.get("/api/stats/today", async (req) => {
    const user = requireUser(req, deps);
    return statsToday(
      deps.db,
      user.id,
      tzQuery(req.query),
      deps.now(),
      tagIdQuery(req.query),
      rollupQuery(req.query),
    );
  });

  app.get("/api/stats/range", async (req) => {
    const user = requireUser(req, deps);
    return statsRange(
      deps.db,
      user.id,
      tzQuery(req.query),
      stringQuery(req.query, "from"),
      stringQuery(req.query, "to"),
      deps.now(),
      tagIdQuery(req.query),
      rollupQuery(req.query),
    );
  });
}
