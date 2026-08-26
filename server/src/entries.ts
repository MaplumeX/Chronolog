import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { Db } from "./db.js";
import { clipSeconds, durationSeconds, requireTz, todayBounds, weekBounds, weekDayBounds } from "./time.js";
import { categories, timeEntries } from "./schema.js";

export type EntryDto = {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number;
  clippedSeconds?: number;
};

const entrySelect = {
  id: timeEntries.id,
  categoryId: timeEntries.categoryId,
  categoryName: categories.name,
  description: timeEntries.description,
  startedAt: timeEntries.startedAt,
  stoppedAt: timeEntries.stoppedAt,
};

function overlap(userId: string, dayStart: string, dayEnd: string) {
  return and(
    eq(timeEntries.userId, userId),
    lt(timeEntries.startedAt, dayEnd),
    or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, dayStart)),
  );
}

export function getRunningEntry(db: Db, userId: string, now: Date): EntryDto | null {
  const row = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
    .get();
  if (!row) return null;
  return {
    ...row,
    durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
  };
}

export function getEntry(db: Db, userId: string, id: string, now: Date): EntryDto | null {
  const row = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
    .get();
  if (!row) return null;
  return {
    ...row,
    durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
  };
}

export function listToday(db: Db, userId: string, tzRaw: unknown, now: Date) {
  const tz = requireTz(tzRaw);
  const { dayStart, dayEnd } = todayBounds(tz, now);
  const rows = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(overlap(userId, dayStart, dayEnd))
    .orderBy(desc(timeEntries.startedAt))
    .all();

  const entries: EntryDto[] = rows.map((row) => {
    const clipped = clipSeconds(row.startedAt, row.stoppedAt, dayStart, dayEnd, now);
    return {
      ...row,
      durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
      clippedSeconds: clipped,
    };
  });

  const totalClippedSeconds = entries.reduce((sum, e) => sum + (e.clippedSeconds ?? 0), 0);
  return { tz, dayStart, dayEnd, entries, totalClippedSeconds };
}

export function listWeek(db: Db, userId: string, tzRaw: unknown, now: Date) {
  const tz = requireTz(tzRaw);
  const { weekStart, weekEnd } = weekBounds(tz, now);
  const rows = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(overlap(userId, weekStart, weekEnd))
    .orderBy(desc(timeEntries.startedAt))
    .all();

  // 7 个 [dayStart_i, dayEnd_i) 窗口，周一至周日；每天只保留与当天窗口重叠（clipped > 0）的记录，与 listToday 语义一致
  const days = weekDayBounds(tz, now).map(({ dayStart, dayEnd }) => {
    const entries: EntryDto[] = rows
      .map((row) => {
        const clipped = clipSeconds(row.startedAt, row.stoppedAt, dayStart, dayEnd, now);
        return {
          ...row,
          durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
          clippedSeconds: clipped,
        };
      })
      .filter((e) => (e.clippedSeconds ?? 0) > 0);
    const totalClippedSeconds = entries.reduce((sum, e) => sum + (e.clippedSeconds ?? 0), 0);
    return { tz, dayStart, dayEnd, entries, totalClippedSeconds };
  });

  return { tz, weekStart, weekEnd, days };
}

export function statsToday(db: Db, userId: string, tzRaw: unknown, now: Date) {
  const { tz, dayStart, dayEnd, entries } = listToday(db, userId, tzRaw, now);
  const byId = new Map<string, { categoryId: string; categoryName: string; seconds: number }>();
  for (const e of entries) {
    const seconds = e.clippedSeconds ?? 0;
    if (seconds <= 0) continue;
    const cur = byId.get(e.categoryId);
    if (cur) cur.seconds += seconds;
    else byId.set(e.categoryId, { categoryId: e.categoryId, categoryName: e.categoryName, seconds });
  }
  const grouped = [...byId.values()].sort((a, b) => b.seconds - a.seconds);
  const totalSeconds = grouped.reduce((sum, c) => sum + c.seconds, 0);
  return { tz, dayStart, dayEnd, categories: grouped, totalSeconds };
}
