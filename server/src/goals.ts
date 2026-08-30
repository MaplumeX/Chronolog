import { DateTime } from "luxon";
import { and, eq, exists, gt, isNull, lt, or } from "drizzle-orm";
import type { Db } from "./db.js";
import { clipSeconds, periodBounds } from "./time.js";
import { entryTags, goals, timeEntries } from "./schema.js";

export type GoalStatus = "active" | "achieved" | "expired";

export type GoalWithProgress = {
  id: string;
  name: string;
  icon: string;
  categoryId: string | null;
  tagId: string | null;
  direction: "lt" | "gt";
  hours: number;
  periodUnit: "day" | "week" | "month";
  dueDate: string | null;
  createdAt: string;
  progress: { currentSeconds: number | null; targetSeconds: number };
  status: GoalStatus;
};

type GoalRow = typeof goals.$inferSelect;

/** 与 listToday/statsRange 的 overlap 同构：条目与 [windowStart, windowEnd) 重叠（运行中条目右端为 ∞）。 */
function overlap(userId: string, windowStart: string, windowEnd: string) {
  return and(
    eq(timeEntries.userId, userId),
    lt(timeEntries.startedAt, windowEnd),
    or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, windowStart)),
  );
}

/** 单个 goal 当前周期窗口内匹配条目的 clip 秒数总和。
 * 匹配语义（R2）：categoryId 设置 → 该分类；tagId 设置 → 带该标签；两者都设 → AND；都不设 → 全部。
 * 跨窗口条目按窗口截断，运行中条目按 now 截断（clipSeconds 语义自然继承）。 */
function currentSecondsFor(
  db: Db,
  userId: string,
  goal: Pick<GoalRow, "categoryId" | "tagId">,
  windowStart: string,
  windowEnd: string,
  now: Date,
): number {
  const categoryFilter = goal.categoryId
    ? eq(timeEntries.categoryId, goal.categoryId)
    : undefined;
  const tagFilter = goal.tagId
    ? exists(
        db
          .select({ one: entryTags.entryId })
          .from(entryTags)
          .where(and(eq(entryTags.entryId, timeEntries.id), eq(entryTags.tagId, goal.tagId))),
      )
    : undefined;
  const rows = db
    .select({ startedAt: timeEntries.startedAt, stoppedAt: timeEntries.stoppedAt })
    .from(timeEntries)
    .where(and(overlap(userId, windowStart, windowEnd), categoryFilter, tagFilter))
    .all();
  return rows.reduce(
    (sum, r) => sum + clipSeconds(r.startedAt, r.stoppedAt, windowStart, windowEnd, now),
    0,
  );
}

/** GET /api/goals?tz= 的主体：列出用户全部 goal 并计算当前周期进度。
 * 过期 goal（dueDate 早于 tz 本地今天）不做统计，currentSeconds 为 null。
 * status 三态：achieved（gt 且 current ≥ target；lt 且 current < target）| active | expired。 */
export function listGoalsWithProgress(
  db: Db,
  userId: string,
  tz: string,
  now: Date,
): GoalWithProgress[] {
  const rows = db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt)
    .all();

  const zoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz);
  const today = zoned.toISODate();
  if (!today) throw new Error("unreachable: zoned now has no local date");

  return rows.map((row) => {
    const targetSeconds = Math.round(row.hours * 3600);
    const expired = row.dueDate !== null && row.dueDate < today;
    let currentSeconds: number | null = null;
    let achieved = false;
    if (!expired) {
      const { windowStart, windowEnd } = periodBounds(
        tz,
        row.periodUnit as "day" | "week" | "month",
        now,
      );
      currentSeconds = currentSecondsFor(db, userId, row, windowStart, windowEnd, now);
      achieved =
        row.direction === "gt"
          ? currentSeconds >= targetSeconds
          : currentSeconds < targetSeconds;
    }
    const direction = row.direction as "lt" | "gt";
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      categoryId: row.categoryId ?? null,
      tagId: row.tagId ?? null,
      direction,
      hours: row.hours,
      periodUnit: row.periodUnit as "day" | "week" | "month",
      dueDate: row.dueDate ?? null,
      createdAt: row.createdAt,
      progress: { currentSeconds, targetSeconds },
      status: (expired ? "expired" : achieved ? "achieved" : "active") as GoalStatus,
    };
  });
}
