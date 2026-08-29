import { and, desc, eq, exists, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "./db.js";
import { AppError } from "./errors.js";
import {
  clipSeconds,
  dateDayBounds,
  dateWeekBounds,
  dateWeekDayBounds,
  durationSeconds,
  parseDateParam,
  rangeDayBounds,
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

/** 窗口紧邻外侧条目：prevEntry = startedAt < start 且（未结束或已结束且 stoppedAt <= start）中右端（stoppedAt ?? ∞）最大的一条；nextEntry = startedAt >= end 中 startedAt 最小的一条。 */
export function listBoundary(
  db: Db,
  userId: string,
  tzRaw: unknown,
  startIso: string,
  endIso: string,
  now: Date,
) {
  const tz = requireTz(tzRaw);
  const prevRow = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(
      and(
        eq(timeEntries.userId, userId),
        lt(timeEntries.startedAt, startIso),
        // 未结束（running）条目也参与前邻：右端为 ∞，coalesce 排序下自然最大（跨过 start 仍在运行的条目右端覆盖窗口起点，前端据此判定无顶部空档）
        or(isNull(timeEntries.stoppedAt), lte(timeEntries.stoppedAt, startIso)),
      ),
    )
    .orderBy(desc(sql`coalesce(${timeEntries.stoppedAt}, '9999')`), desc(timeEntries.startedAt))
    .get();
  const nextRow = db
    .select(entrySelect)
    .from(timeEntries)
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(and(eq(timeEntries.userId, userId), gte(timeEntries.startedAt, endIso)))
    .orderBy(timeEntries.startedAt)
    .get();

  const toDto = (row: typeof prevRow | null): EntryDto | null => {
    if (!row) return null;
    const entry: EntryDto = {
      ...row,
      durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
      tags: [],
    };
    attachTags(db, [entry]);
    return entry;
  };

  return { tz, prevEntry: toDto(prevRow), nextEntry: toDto(nextRow) };
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

export const STATS_RANGE_MAX_DAYS = 92;

export type RangeStats = {
  tz: string;
  rangeStart: string;
  rangeEnd: string;
  days: { date: string; seconds: number }[];
  categories: { categoryId: string; categoryName: string; seconds: number }[];
  tags: { tagId: string | null; tagName: string | null; seconds: number }[];
  totalSeconds: number;
};

/** GET /api/stats/range：tz 本地日期闭区间 [from, to] 的多路聚合统计。
 *
 * - days：逐日 clip 秒数，空白天也输出（含 0）；date 为 tz 本地 YYYY-MM-DD
 * - categories：range 级 clip（首日 dayStart 到末日 dayEnd）按分类聚合，降序
 * - tags：attachTags 后多标签条目在每个标签下计入全额 clipped 秒（tags 总和可能 > totalSeconds，UI 不应展示 tags 总和）；
 *   无任何标签的秒数进 tagId:null 桶，降序
 * - 运行中条目按 now 裁剪（clipSeconds 语义自然继承） */
export function statsRange(
  db: Db,
  userId: string,
  tzRaw: unknown,
  fromRaw: unknown,
  toRaw: unknown,
  now: Date,
  tagId?: string,
): RangeStats {
  const tz = requireTz(tzRaw);
  // 校验顺序：tz（requireTz 已抛）→ from/to 日期 → from > to → 区间过大
  if (typeof fromRaw !== "string" || typeof toRaw !== "string" || !parseDateParam(fromRaw, tz) || !parseDateParam(toRaw, tz)) {
    throw new AppError(400, "VALIDATION", "日期无效");
  }
  const from = fromRaw as string;
  const to = toRaw as string;
  if (to < from) {
    throw new AppError(400, "VALIDATION", "起始日期不能晚于结束日期");
  }
  const bounds = rangeDayBounds(tz, from, to);
  if (!bounds) throw new AppError(400, "VALIDATION", "日期无效"); // 理论不可达，防御
  if (bounds.days.length > STATS_RANGE_MAX_DAYS) {
    throw new AppError(400, "VALIDATION", "日期区间过大");
  }
  if (tagId !== undefined) {
    const owned = db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .get();
    if (!owned) throw new AppError(404, "NOT_FOUND", "标签不存在");
  }

  const { rangeStart, rangeEnd, days } = bounds;
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
    .where(and(overlap(userId, rangeStart, rangeEnd), tagFilter))
    .all();
  const entries: EntryDto[] = rows.map((row) => ({
    ...row,
    durationSeconds: durationSeconds(row.startedAt, row.stoppedAt, now),
    tags: [],
  }));
  attachTags(db, entries);

  // range 级 clip 秒数（运行中条目按 now 裁剪）
  const rangeClipped = new Map<string, number>(); // entryId -> clipped seconds
  const catById = new Map<string, { categoryId: string; categoryName: string; seconds: number }>();
  for (const e of entries) {
    const seconds = clipSeconds(e.startedAt, e.stoppedAt, rangeStart, rangeEnd, now);
    rangeClipped.set(e.id, seconds);
    if (seconds <= 0) continue;
    const cur = catById.get(e.categoryId);
    if (cur) cur.seconds += seconds;
    else catById.set(e.categoryId, { categoryId: e.categoryId, categoryName: e.categoryName, seconds });
  }
  const categoriesGrouped = [...catById.values()].sort((a, b) => b.seconds - a.seconds);
  const totalSeconds = categoriesGrouped.reduce((sum, c) => sum + c.seconds, 0);

  // days：逐日窗口 clip 求和（含 0 天）
  const dayRows = days.map(({ date, dayStart, dayEnd }) => {
    let seconds = 0;
    for (const e of entries) {
      seconds += clipSeconds(e.startedAt, e.stoppedAt, dayStart, dayEnd, now);
    }
    return { date, seconds };
  });

  // tags：多标签条目每个标签计入全额 clipped 秒；无标签秒数进 null 桶
  const tagById = new Map<string, { tagId: string | null; tagName: string | null; seconds: number }>();
  const noTagKey = "\u0000"; // 用哨兵 key 区分 null 桶与真实 tagId
  for (const e of entries) {
    const seconds = rangeClipped.get(e.id) ?? 0;
    if (seconds <= 0) continue;
    if (e.tags.length === 0) {
      const cur = tagById.get(noTagKey);
      if (cur) cur.seconds += seconds;
      else tagById.set(noTagKey, { tagId: null, tagName: null, seconds });
    } else {
      for (const t of e.tags) {
        const cur = tagById.get(t.id);
        if (cur) cur.seconds += seconds;
        else tagById.set(t.id, { tagId: t.id, tagName: t.name, seconds });
      }
    }
  }
  const tagsGrouped = [...tagById.values()].sort((a, b) => b.seconds - a.seconds);

  return { tz, rangeStart, rangeEnd, days: dayRows, categories: categoriesGrouped, tags: tagsGrouped, totalSeconds };
}
