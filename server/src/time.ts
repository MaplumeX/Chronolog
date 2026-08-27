import { DateTime, IANAZone } from "luxon";
import { AppError } from "./errors.js";

export function requireTz(tz: unknown): string {
  if (typeof tz !== "string" || tz.length === 0 || !IANAZone.isValidZone(tz)) {
    throw new AppError(400, "VALIDATION", "时区无效");
  }
  return tz;
}

function zonedNow(tz: string, now: Date): DateTime {
  return DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz);
}

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 校验 "YYYY-MM-DD" 是否为真实存在的日历日期（如 2025-02-30 无效，且不能滚溢出）。 */
function isValidDateParam(date: string, tz: string): boolean {
  if (!DATE_PARAM_RE.test(date)) return false;
  const d = DateTime.fromISO(date, { zone: tz });
  return d.isValid && d.toISODate() === date;
}

/** 将 "YYYY-MM-DD" 解释为 tz 本地日期锚点；校验失败返回 null（调用方转 400）。 */
export function parseDateParam(date: string, tz: string): DateTime | null {
  return isValidDateParam(date, tz) ? DateTime.fromISO(date, { zone: tz }) : null;
}

/** 路由层校验 date query 参数；缺省返回 undefined，无效抛 400 VALIDATION "日期无效"。 */
export function requireDate(date: unknown, tz: string): string | undefined {
  if (date === undefined) return undefined;
  if (typeof date !== "string" || !isValidDateParam(date, tz)) {
    throw new AppError(400, "VALIDATION", "日期无效");
  }
  return date;
}

function dayBoundsFrom(zoned: DateTime): { dayStart: string; dayEnd: string } {
  const start = zoned.startOf("day");
  const end = start.plus({ days: 1 });
  return {
    dayStart: start.toUTC().toJSDate().toISOString(),
    dayEnd: end.toUTC().toJSDate().toISOString(),
  };
}

function weekBoundsFrom(zoned: DateTime): { weekStart: string; weekEnd: string } {
  const start = zoned.startOf("week"); // luxon 默认周一为一周起点，符合 ISO 周
  const end = start.plus({ days: 7 });
  return {
    weekStart: start.toUTC().toJSDate().toISOString(),
    weekEnd: end.toUTC().toJSDate().toISOString(),
  };
}

export function todayBounds(tz: string, now: Date): { dayStart: string; dayEnd: string } {
  return dayBoundsFrom(zonedNow(tz, now));
}

/** 指定日期的 day 边界（tz 本地 00:00 起 24 小时）；date 无效返回 null。 */
export function dateDayBounds(tz: string, date: string): { dayStart: string; dayEnd: string } | null {
  const anchor = parseDateParam(date, tz);
  return anchor ? dayBoundsFrom(anchor) : null;
}

export function weekBounds(tz: string, now: Date): { weekStart: string; weekEnd: string } {
  return weekBoundsFrom(zonedNow(tz, now));
}

/** 指定日期所在 ISO 周的周界；date 无效返回 null。 */
export function dateWeekBounds(tz: string, date: string): { weekStart: string; weekEnd: string } | null {
  const anchor = parseDateParam(date, tz);
  return anchor ? weekBoundsFrom(anchor) : null;
}

/** 指定日期所在 ISO 周的 7 个逐日窗口；date 无效返回 null。 */
export function dateWeekDayBounds(tz: string, date: string): { dayStart: string; dayEnd: string }[] | null {
  const anchor = parseDateParam(date, tz);
  return anchor ? weekDayBoundsFrom(anchor.startOf("week")) : null;
}

/** 周内 7 个 [dayStart_i, dayEnd_i) 窗口（周一至周日），逐天按 tz 本地午夜计算，与 todayBounds 同构。
 * dayEnd 从下一天的本地午夜推导（weekStart.plus({ days: i + 1 })），避免午夜 DST 跳变时
 * start.plus({ days: 1 }) 把窗口末端偏移一小时（如 America/Santiago 周日 00:00 拨快）。 */
export function weekDayBounds(tz: string, now: Date): { dayStart: string; dayEnd: string }[] {
  const weekStart = zonedNow(tz, now).startOf("week");
  return weekDayBoundsFrom(weekStart);
}

function weekDayBoundsFrom(weekStart: DateTime): { dayStart: string; dayEnd: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const start = weekStart.plus({ days: i });
    const end = weekStart.plus({ days: i + 1 });
    return {
      dayStart: start.toUTC().toJSDate().toISOString(),
      dayEnd: end.toUTC().toJSDate().toISOString(),
    };
  });
}

export function clipSeconds(
  startedAt: string,
  stoppedAt: string | null,
  dayStart: string,
  dayEnd: string,
  now: Date,
): number {
  const start = Math.max(Date.parse(startedAt), Date.parse(dayStart));
  const end = Math.min(stoppedAt ? Date.parse(stoppedAt) : now.getTime(), Date.parse(dayEnd));
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function durationSeconds(startedAt: string, stoppedAt: string | null, now: Date): number {
  const end = stoppedAt ? Date.parse(stoppedAt) : now.getTime();
  return Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000));
}
