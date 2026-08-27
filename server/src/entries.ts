import { and, desc, eq, exists, gt, inArray, isNull, lt, or } from "drizzle-orm";
import type { Db } from "./db.js";
import { AppError } from "./errors.js";
import {
  clipSeconds,
  dateDayBounds,
  dateWeekBounds,
  dateWeekDayBounds,
  durationSeconds,
  requireTz,
  todayBounds,
  weekBounds,
  weekDayBounds,
} from "./time.js";
import { categories, entryTags, tags, timeEntries } from "./schema.js";

export type EntryDto = {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number;
  clippedSeconds?: number;
  tags: { id: string; name: string }[];
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

function attachTags(db: Db, entries: EntryDto[]): void {
  if (entries.length === 0) return;
  const ids = entries.map((e) => e.id);
  const rows = db
    .select({ entryId: entryTags.entryId, id: tags.id, name: tags.name })
    .from(entryTags)
    .innerJoin(tags, eq(tags.id, entryTags.tagId))
    .where(inArray(entryTags.entryId, ids))
    .orderBy(tags.name)
    .all();
  const byEntry = new Map<string, { id: string; name: string }[]>();
  for (const r of rows) {
    const list = byEntry.get(r.entryId);
    if (list) list.push({ id: r.id, name: r.name });
    else byEntry.set(r.entryId, [{ id: r.id, name: r.name }]);
  }
  for (const e of entries) e.tags = byEntry.get(e.id) ?? [];
}

export function getRunningEntry(db: Db, userId: string, now: Date): EntryDto | null {
  const row = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
    .get();
  if (!row) return null;
  const entry: EntryDto = {
    ...row,
    durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
    tags: [],
  };
  attachTags(db, [entry]);
  return entry;
}

export function getEntry(db: Db, userId: string, id: string, now: Date): EntryDto | null {
  const row = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
    .get();
  if (!row) return null;
  const entry: EntryDto = {
    ...row,
    durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
    tags: [],
  };
  attachTags(db, [entry]);
  return entry;
}

export function listToday(
  db: Db,
  userId: string,
  tzRaw: unknown,
  now: Date,
  tagId?: string,
  date?: string,
) {
  const tz = requireTz(tzRaw);
  // date 存在时锚定该日（tz 本地），否则以 now 所在日为锚；clipSeconds 的 now 不变（运行中条目按真实当前时间裁剪）
  const { dayStart, dayEnd } = (date ? dateDayBounds(tz, date) : null) ?? todayBounds(tz, now);
  const tagFilter =
    tagId !== undefined
      ? exists(
          db
            .select({ one: entryTags.entryId })
            .from(entryTags)
            .where(
              and(
                eq(entryTags.entryId, timeEntries.id),
                eq(entryTags.tagId, tagId),
              ),
            ),
        )
      : undefined;
  const rows = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(and(overlap(userId, dayStart, dayEnd), tagFilter))
    .orderBy(desc(timeEntries.startedAt))
    .all();

  const entries: EntryDto[] = rows.map((row) => {
    const clipped = clipSeconds(row.startedAt, row.stoppedAt, dayStart, dayEnd, now);
    return {
      ...row,
      durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
      clippedSeconds: clipped,
      tags: [],
    };
  });
  attachTags(db, entries);

  const totalClippedSeconds = entries.reduce((sum, e) => sum + (e.clippedSeconds ?? 0), 0);
  return { tz, dayStart, dayEnd, entries, totalClippedSeconds };
}

export function listWeek(db: Db, userId: string, tzRaw: unknown, now: Date, date?: string) {
  const tz = requireTz(tzRaw);
  // date 存在时锚定该日所在 ISO 周；date 是周内任意一天都会归一化到同一周
  const { weekStart, weekEnd } = (date ? dateWeekBounds(tz, date) : null) ?? weekBounds(tz, now);
  const rows = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(overlap(userId, weekStart, weekEnd))
    .orderBy(desc(timeEntries.startedAt))
    .all();

  // 7 个 [dayStart_i, dayEnd_i) 窗口，周一至周日；每天只保留与当天窗口重叠（clipped > 0）的记录，与 listToday 语义一致
  const days = ((date ? dateWeekDayBounds(tz, date) : null) ?? weekDayBounds(tz, now)).map(
    ({ dayStart, dayEnd }) => {
      const entries: EntryDto[] = rows
        .map((row) => {
          const clipped = clipSeconds(row.startedAt, row.stoppedAt, dayStart, dayEnd, now);
          return {
            ...row,
            durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
            clippedSeconds: clipped,
            tags: [],
          };
        })
        .filter((e) => (e.clippedSeconds ?? 0) > 0);
      attachTags(db, entries);
      const totalClippedSeconds = entries.reduce((sum, e) => sum + (e.clippedSeconds ?? 0), 0);
      return { tz, dayStart, dayEnd, entries, totalClippedSeconds };
    },
  );

  return { tz, weekStart, weekEnd, days };
}

export function statsToday(db: Db, userId: string, tzRaw: unknown, now: Date, tagId?: string) {
  if (tagId !== undefined) {
    const owned = db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .get();
    if (!owned) throw new AppError(404, "NOT_FOUND", "标签不存在");
  }
  const { tz, dayStart, dayEnd, entries } = listToday(db, userId, tzRaw, now, tagId);
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
