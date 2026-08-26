import { DateTime, IANAZone } from "luxon";
import { AppError } from "./errors.js";

export function requireTz(tz: unknown): string {
  if (typeof tz !== "string" || tz.length === 0 || !IANAZone.isValidZone(tz)) {
    throw new AppError(400, "VALIDATION", "时区无效");
  }
  return tz;
}

export function todayBounds(tz: string, now: Date): { dayStart: string; dayEnd: string } {
  const zoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz);
  const start = zoned.startOf("day");
  const end = start.plus({ days: 1 });
  return {
    dayStart: start.toUTC().toJSDate().toISOString(),
    dayEnd: end.toUTC().toJSDate().toISOString(),
  };
}

export function weekBounds(tz: string, now: Date): { weekStart: string; weekEnd: string } {
  const zoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz);
  const start = zoned.startOf("week"); // luxon 默认周一为一周起点，符合 ISO 周
  const end = start.plus({ days: 7 });
  return {
    weekStart: start.toUTC().toJSDate().toISOString(),
    weekEnd: end.toUTC().toJSDate().toISOString(),
  };
}

/** 周内 7 个 [dayStart_i, dayEnd_i) 窗口（周一至周日），逐天按 tz 本地午夜计算，与 todayBounds 同构。
 * dayEnd 从下一天的本地午夜推导（weekStart.plus({ days: i + 1 })），避免午夜 DST 跳变时
 * start.plus({ days: 1 }) 把窗口末端偏移一小时（如 America/Santiago 周日 00:00 拨快）。 */
export function weekDayBounds(tz: string, now: Date): { dayStart: string; dayEnd: string }[] {
  const zoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(tz);
  const weekStart = zoned.startOf("week");
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
