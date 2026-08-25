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
