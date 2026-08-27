import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth.js";
import type { Deps } from "../db.js";
import { listToday, listWeek, statsToday } from "../entries.js";
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

function tagIdQuery(query: unknown): string | undefined {
  if (query && typeof query === "object" && "tagId" in query) {
    const v = (query as { tagId: unknown }).tagId;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

export function registerTodayRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/api/entries/today", async (req) => {
    const user = requireUser(req, deps);
    const tz = requireTz(tzQuery(req.query));
    const date = dateQuery(req.query, tz);
    return listToday(deps.db, user.id, tz, deps.now(), undefined, date);
  });

  app.get("/api/entries/week", async (req) => {
    const user = requireUser(req, deps);
    const tz = requireTz(tzQuery(req.query));
    const date = dateQuery(req.query, tz);
    return listWeek(deps.db, user.id, tz, deps.now(), date);
  });

  app.get("/api/stats/today", async (req) => {
    const user = requireUser(req, deps);
    return statsToday(deps.db, user.id, tzQuery(req.query), deps.now(), tagIdQuery(req.query));
  });
}
