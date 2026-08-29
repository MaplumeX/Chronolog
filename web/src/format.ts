import i18n, { localeFor } from "./i18n";

export function browserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatClock(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString(localeFor(i18n.language), {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDayLabel(tz: string): string {
  const date = new Date().toLocaleDateString(localeFor(i18n.language), {
    timeZone: tz,
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return `${i18n.t("timeline.todayPrefix")}${date}`;
}

/** 周范围文案，如 `8月24日 – 8月30日`。周日 = weekEnd 前一刻（DST 回拨周 weekStart+6*24h 会落到周六 23:00）。 */
export function formatWeekLabel(weekStart: string, weekEnd: string, tz: string): string {
  const locale = localeFor(i18n.language);
  const start = new Date(weekStart).toLocaleDateString(locale, {
    timeZone: tz,
    month: "long",
    day: "numeric",
  });
  const end = new Date(Date.parse(weekEnd) - 1).toLocaleDateString(locale, {
    timeZone: tz,
    month: "long",
    day: "numeric",
  });
  return `${start} – ${end}`;
}

/** 周视图列头：日期数字 + 星期文案。iso 为该天 00:00 的 UTC ISO-Z 字符串。 */
export function formatWeekdayHeader(iso: string, tz: string): { day: string; weekday: string } {
  const locale = localeFor(i18n.language);
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString(locale, { timeZone: tz, day: "numeric" }),
    weekday: date.toLocaleDateString(locale, { timeZone: tz, weekday: "long" }),
  };
}

export function elapsedSeconds(startedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAt)) / 1000));
}

/** Clip an entry to [dayStart, dayEnd). Running entries use nowMs as the end. */
export function clipSeconds(
  startedAt: string,
  stoppedAt: string | null,
  dayStart: string,
  dayEnd: string,
  nowMs: number,
): number {
  const start = Math.max(Date.parse(startedAt), Date.parse(dayStart));
  const end = Math.min(stoppedAt ? Date.parse(stoppedAt) : nowMs, Date.parse(dayEnd));
  return Math.max(0, Math.floor((end - start) / 1000));
}

// 分类色板：token 引用（值定义在 web/src/styles.css 的 :root（light）/ .dark（dark）两套 --category-1..8）。
// 色相绕色环均匀分布；185–225 青色区间留给 primary，避免混淆。分类颜色不落库，始终由名称 hash 分配。
const CATEGORY_VARS = [
  "var(--category-1)",
  "var(--category-2)",
  "var(--category-3)",
  "var(--category-4)",
  "var(--category-5)",
  "var(--category-6)",
  "var(--category-7)",
  "var(--category-8)",
];

/** 分类名称 → 色板索引（0–7）。hash 逻辑不可改动：分类颜色不落库，改 hash 会改变既有映射。 */
export function categoryIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % CATEGORY_VARS.length;
}

export function categoryColor(name: string): string {
  return CATEGORY_VARS[categoryIndex(name)];
}
