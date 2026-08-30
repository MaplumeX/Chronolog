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

/** tz 本地日期闭区间 [from, to] 的逐日窗口，外加 range 首尾（rangeStart = 首日 dayStart，rangeEnd = 末日 dayEnd，[start, end) 半开）。
 * 逐日用 luxon plus({ days: i }) 从 from 锚点推导（与 weekDayBoundsFrom 同构，DST 安全）。
 * from/to 任一无效或 from > to 返回 null（调用方负责细粒度报错）。 */
export function rangeDayBounds(
  tz: string,
  from: string,
  to: string,
): { rangeStart: string; rangeEnd: string; days: { date: string; dayStart: string; dayEnd: string }[] } | null {
  const fromAnchor = parseDateParam(from, tz);
  const toAnchor = parseDateParam(to, tz);
  if (!fromAnchor || !toAnchor || toAnchor < fromAnchor) return null;
  const dayCount = Math.round(toAnchor.diff(fromAnchor, "days").days) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => {
    const start = fromAnchor.plus({ days: i });
    const end = fromAnchor.plus({ days: i + 1 });
    return {
      date: start.toISODate() ?? "",
      dayStart: start.toUTC().toJSDate().toISOString(),
      dayEnd: end.toUTC().toJSDate().toISOString(),
    };
  });
  return {
    rangeStart: days[0].dayStart,
    rangeEnd: days[dayCount - 1].dayEnd,
    days,
  };
}

/** 目标周期窗口：day/week 复用现有边界逻辑，month 为自然月（月初到下月月初，半开区间）。
 * 月末窗口从月首 plus({ months: 1 }) 推导（与 weekBoundsFrom 同构的 DST 安全写法：
 * luxon 的 plus 在本地日历上运算，避开毫秒加法在 DST 跳变日偏移一小时的问题）。 */
export function periodBounds(
  tz: string,
  unit: "day" | "week" | "month",
  now: Date,
): { windowStart: string; windowEnd: string } {
  if (unit === "day") {
    const { dayStart, dayEnd } = todayBounds(tz, now);
    return { windowStart: dayStart, windowEnd: dayEnd };
  }
  if (unit === "week") {
    const { weekStart, weekEnd } = weekBounds(tz, now);
    return { windowStart: weekStart, windowEnd: weekEnd };
  }
  const start = zonedNow(tz, now).startOf("month");
  const end = start.plus({ months: 1 });
  return {
    windowStart: start.toUTC().toJSDate().toISOString(),
    windowEnd: end.toUTC().toJSDate().toISOString(),
  };
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
