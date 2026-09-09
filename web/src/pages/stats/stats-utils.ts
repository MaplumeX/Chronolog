import type { TimeEntry } from "../../api";

/* ---------- 纯日历日期工具（"YYYY-MM-DD" 是日历标签，UTC 午夜运算无 DST 问题） ---------- */
/* 自旧 StatsPage.tsx 迁移，实现保持不变。 */

/** "YYYY-MM-DD" → UTC 午夜 Date，仅用于纯日历运算/格式化。 */
export function toDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 纯日历日期加减。 */
export function shiftDate(date: string, days: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 归一化到所在 ISO 周的周一（与后端 weekBounds 的周一对齐）。 */
export function toWeekStart(date: string): string {
  const d = toDate(date);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** tz 当地的今天（Intl 格式化，安全跨时区，勿用 toISOString().slice）。 */
export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 闭区间天数。 */
export function countDays(from: string, to: string): number {
  return (
    Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000) + 1
  );
}

/** "YYYY-MM-DD" → 本地午夜 Date（浏览器时区，供 Calendar 使用）。 */
export function toLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date（本地午夜，来自 Calendar）→ "YYYY-MM-DD"。 */
export function fromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 当月 1 日..月末（纯日历运算，闰年安全）。 */
export function monthBounds(date: string): { from: string; to: string } {
  const [y, m] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDay)}` };
}

/* ---------- tz 日历日 ↔ UTC 瞬时（DST 安全，不依赖任何日期库） ---------- */

/** 给定瞬时时 tz 的偏移量（ms，东半球为正）。 */
function tzOffsetMs(tz: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(atMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  // hour 可能出现 "24"（部分实现的 h24 行为），% 24 归一
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - Math.floor(atMs / 1000) * 1000;
}

/** tz 本地 date 的 h:00 墙时对应的 UTC 瞬时（ms）。
 * 反推迭代收敛（naive UTC 墙时 − 该处的 tz 偏移）；DST 跳变墙时（不存在/出现两次）
 * 会收敛到临近的一个可表示瞬时，由调用方做单调性防御。 */
export function tzWallHourMs(tz: string, date: string, hour: number): number {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour);
  let ts = naive;
  for (let i = 0; i < 4; i++) {
    const next = naive - tzOffsetMs(tz, ts);
    if (next === ts) break;
    ts = next;
  }
  return ts;
}

/** tz 本地某日的 [dayStart, dayEnd) 窗口（UTC ms；DST 跳变日可能 ≠ 24h）。 */
export function dayWindowMs(
  tz: string,
  date: string,
): { startMs: number; endMs: number } {
  return {
    startMs: tzWallHourMs(tz, date, 0),
    endMs: tzWallHourMs(tz, shiftDate(date, 1), 0),
  };
}

/* ---------- 聚合：未记录桶 / 小时分摊 / 逐日矩阵 ---------- */

/** 分类聚合 key：categoryId 为 null（未分类）时的哨兵。 */
export const NULL_CATEGORY_KEY = "";

/** 条目的有效右端（运行中按 nowMs 裁剪）。 */
function effectiveEndMs(entry: TimeEntry, nowMs: number): number {
  return entry.stoppedAt !== null ? Date.parse(entry.stoppedAt) : nowMs;
}

/** 一天的 24 个 wall-clock 小时桶边界（含首尾共 25 个，ms）。
 * DST 跳变日强制单调不减（不存在的墙时 → 0 宽桶，出现两次的墙时 → 2 小时宽桶）。 */
function hourBoundaries(tz: string, date: string): number[] {
  const boundaries: number[] = [];
  for (let h = 0; h <= 24; h++) boundaries.push(tzWallHourMs(tz, date, h));
  for (let h = 1; h <= 24; h++) {
    if (boundaries[h] < boundaries[h - 1]) boundaries[h] = boundaries[h - 1];
  }
  return boundaries;
}

export type HourlyBucket = {
  /** wall-clock 小时 0..23 */
  hour: number;
  startMs: number;
  endMs: number;
  /** 桶内每分类秒数（key = categoryId ?? NULL_CATEGORY_KEY） */
  categories: Record<string, number>;
  /** 桶宽 − 已覆盖（该小时未被任何条目记录的秒数） */
  unlogged: number;
};

export type HourlyByCategory = {
  hours: HourlyBucket[];
  /** 聚合中出现的分类名（key 同 categories；未分类 key = NULL_CATEGORY_KEY） */
  categoryNames: Record<string, string>;
  dayStartMs: number;
  dayEndMs: number;
  /** 日窗口秒数（DST 日 ≠ 86400） */
  windowSeconds: number;
  coveredSeconds: number;
};

/** 当日条目按与 [h:00, h+1:00) 的重叠秒数分摊到 24 桶，桶内按分类累加。
 * - 跨午夜条目裁剪到当日窗口 [dayStart, dayEnd)
 * - 运行中条目（stoppedAt null）右端取 nowMs
 * - 未记录 = 桶宽 − 桶内已覆盖 */
export function hourlyByCategory(
  entries: TimeEntry[],
  tz: string,
  date: string,
  nowMs: number,
): HourlyByCategory {
  const boundaries = hourBoundaries(tz, date);
  const dayStart = boundaries[0];
  const dayEnd = boundaries[24];

  const hours: HourlyBucket[] = [];
  for (let h = 0; h < 24; h++) {
    hours.push({
      hour: h,
      startMs: boundaries[h],
      endMs: boundaries[h + 1],
      categories: {},
      unlogged: 0,
    });
  }
  const categoryNames: Record<string, string> = {};
  let covered = 0;

  for (const e of entries) {
    const s = Date.parse(e.startedAt);
    const end = Math.min(effectiveEndMs(e, nowMs), dayEnd);
    if (Number.isNaN(s) || end <= dayStart || end <= s) continue;
    const cs = Math.max(s, dayStart);
    const key = e.categoryId ?? NULL_CATEGORY_KEY;
    categoryNames[key] = e.categoryName;
    for (const b of hours) {
      const overlapMs = Math.min(end, b.endMs) - Math.max(cs, b.startMs);
      if (overlapMs > 0) {
        b.categories[key] = (b.categories[key] ?? 0) + overlapMs / 1000;
        covered += overlapMs / 1000;
      }
    }
  }

  for (const b of hours) {
    const widthSeconds = (b.endMs - b.startMs) / 1000;
    const bucketCovered = Object.values(b.categories).reduce(
      (sum, s) => sum + s,
      0,
    );
    b.unlogged = Math.max(0, widthSeconds - bucketCovered);
  }

  return {
    hours,
    categoryNames,
    dayStartMs: dayStart,
    dayEndMs: dayEnd,
    windowSeconds: (dayEnd - dayStart) / 1000,
    coveredSeconds: covered,
  };
}

export type DailyByCategoryDay = {
  date: string;
  startMs: number;
  endMs: number;
  /** 当日窗口秒数（DST 日 ≠ 86400） */
  windowSeconds: number;
  coveredSeconds: number;
  /** 当日每分类秒数（key = categoryId ?? NULL_CATEGORY_KEY） */
  categories: Record<string, number>;
  /** 窗口 − 已覆盖 */
  unlogged: number;
};

export type DailyByCategory = {
  days: DailyByCategoryDay[];
  /** 聚合中出现的分类名（key 同 categories；未分类 key = NULL_CATEGORY_KEY） */
  categoryNames: Record<string, string>;
};

/** 逐日 × 分类秒数矩阵 + 每日未记录秒数。
 * days 只消费其 date（顺序即输出顺序，应来自 statsRange.days）；
 * 跨午夜条目按日窗口切分，运行中条目右端取 nowMs。 */
export function dailyByCategory(
  entries: TimeEntry[],
  tz: string,
  days: Array<{ date: string }>,
  nowMs: number,
): DailyByCategory {
  const categoryNames: Record<string, string> = {};
  const out: DailyByCategoryDay[] = days.map(({ date }) => {
    const { startMs, endMs } = dayWindowMs(tz, date);
    return {
      date,
      startMs,
      endMs,
      windowSeconds: (endMs - startMs) / 1000,
      coveredSeconds: 0,
      categories: {},
      unlogged: 0,
    };
  });

  for (const e of entries) {
    const s = Date.parse(e.startedAt);
    const endRaw = effectiveEndMs(e, nowMs);
    if (Number.isNaN(s)) continue;
    const key = e.categoryId ?? NULL_CATEGORY_KEY;
    categoryNames[key] = e.categoryName;
    for (const day of out) {
      if (endRaw <= day.startMs || s >= day.endMs) continue;
      const overlapMs = Math.min(endRaw, day.endMs) - Math.max(s, day.startMs);
      if (overlapMs <= 0) continue;
      day.categories[key] = (day.categories[key] ?? 0) + overlapMs / 1000;
      day.coveredSeconds += overlapMs / 1000;
    }
  }

  for (const day of out) {
    day.unlogged = Math.max(0, day.windowSeconds - day.coveredSeconds);
  }

  return { days: out, categoryNames };
}

/* ---------- 环比 / 记录纪律 ---------- */

/** 环比百分比：(current − previous) / previous × 100。
 * previous === 0 → null（UI 显示 "—"）；含 current = previous = 0 的情形。 */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** 窗口内最长连续 seconds > 0 的天数（按日期邻接判断，断档即重置）。 */
export function longestStreak(
  days: Array<{ date: string; seconds: number }>,
): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    const contiguous = prev !== null && shiftDate(prev, 1) === d.date;
    run = d.seconds > 0 ? (contiguous ? run + 1 : 1) : 0;
    if (run > best) best = run;
    prev = d.date;
  }
  return best;
}

/** 月窗口记录完整度：有记录天数 / 已过天数。
 * 已过 = min(今天, 月末)；未来日期不计入分母，也不计入分子。 */
export function coverageDays(
  days: Array<{ date: string; seconds: number }>,
  todayDate: string,
  monthEnd: string,
): { recorded: number; elapsed: number } {
  const limit = todayDate < monthEnd ? todayDate : monthEnd;
  let recorded = 0;
  let elapsed = 0;
  for (const d of days) {
    if (d.date > limit) continue;
    elapsed += 1;
    if (d.seconds > 0) recorded += 1;
  }
  return { recorded, elapsed };
}
