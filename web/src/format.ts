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

/** 把条目起止（ms）夹到当天窗口 [dayStartMs, dayEndMs)。stoppedAtMs 传 null 表示运行中，用 nowMs。 */
export function clipRangeMs(
  startedAtMs: number,
  stoppedAtMs: number | null,
  dayStartMs: number,
  dayEndMs: number,
  nowMs: number,
): { startMs: number; endMs: number } {
  return {
    startMs: Math.max(startedAtMs, dayStartMs),
    endMs: Math.min(stoppedAtMs ?? nowMs, dayEndMs),
  };
}

/** 日历标签缓存（tz 下瞬时的 YYYY-MM-DD 与日序数）：避免每次渲染重复构造 Intl.DateTimeFormat。 */
const dayPartsFmtCache = new Map<string, Intl.DateTimeFormat>();
const dayLabelCache = new Map<string, { label: string; ord: number }>();

/** tz 下某瞬时所在日历日：label = "YYYY-MM-DD"，ord = 日序数（UTC 午夜 ms / 86400000，同 tz 内相减得天数差）。 */
function dayParts(ms: number, tz: string): { label: string; ord: number } {
  const key = `${ms}|${tz}`;
  const cached = dayLabelCache.get(key);
  if (cached) return cached;
  let fmt = dayPartsFmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    dayPartsFmtCache.set(tz, fmt);
  }
  const label = fmt.format(new Date(ms)); // "YYYY-MM-DD"
  const parts = { label, ord: Date.parse(`${label}T00:00:00.000Z`) / 86_400_000 };
  dayLabelCache.set(key, parts);
  return parts;
}

/**
 * 条目时间范围文案（块上与 tooltip 共用）：
 * - 非跨天条目（起止同一日历日）→ `HH:MM – HH:MM`；
 * - 跨天条目 → 起止两端都带 `MM-DD` 完整日期：`MM-DD HH:MM – MM-DD HH:MM`
 *   （含落在今天的那端；不用「昨天/明天」相对词）。
 * 是否跨天按起止所在 tz 日历日判断；stoppedAt=null 右端显示 `…`
 * （运行中条目 right edge 为 now，跨天判断以 startedAt 与 now 比较）。
 */
export function formatEntryTimeRange(
  startedAt: string,
  stoppedAt: string | null,
  tz: string,
  nowMs: number,
): string {
  const startMs = Date.parse(startedAt);
  const endMs = stoppedAt ? Date.parse(stoppedAt) : nowMs;
  const crossDay = dayParts(startMs, tz).ord !== dayParts(endMs, tz).ord;
  const formatEnd = (ms: number): string => {
    const clock = formatClock(new Date(ms).toISOString(), tz);
    if (!crossDay) return clock;
    return `${dayParts(ms, tz).label.slice(5)} ${clock}`; // MM-DD HH:MM
  };
  // 运行中条目右端沿用 `…`；跨天时左端带日期、右端为 `…`
  return `${formatEnd(startMs)} – ${stoppedAt ? formatEnd(endMs) : "…"}`;
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

const CATEGORY_FOREGROUND_VARS = [
  "var(--category-1-foreground)",
  "var(--category-2-foreground)",
  "var(--category-3-foreground)",
  "var(--category-4-foreground)",
  "var(--category-5-foreground)",
  "var(--category-6-foreground)",
  "var(--category-7-foreground)",
  "var(--category-8-foreground)",
];

/** 名称 hash → 前景色 token（色块上文字用，随主题翻转）。hash 逻辑不可改动。 */
export function categoryForegroundColor(name: string): string {
  return CATEGORY_FOREGROUND_VARS[categoryIndex(name)];
}

/** 显式色板索引优先（1–8），未设定（null/undefined/越界）回退名称 hash 色。 */
export function paletteColor(color: number | null | undefined, fallbackName: string): string {
  return color != null && color >= 1 && color <= 8
    ? `var(--category-${color})`
    : categoryColor(fallbackName);
}

/** 同 paletteColor，但返回配套前景色（色块上文字用）。 */
export function paletteForegroundColor(
  color: number | null | undefined,
  fallbackName: string,
): string {
  return color != null && color >= 1 && color <= 8
    ? `var(--category-${color}-foreground)`
    : categoryForegroundColor(fallbackName);
}
