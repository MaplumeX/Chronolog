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

// 分类色板：与 web/src/styles.css 的 --category-1..8 token 同源（light/dark 共用），修改须两边同步。
// 统一 L=0.63 C=0.11，色相绕色环均匀分布；185–225 青色区间留给 primary，避免混淆。
const COLORS = [
  "oklch(0.63 0.11 10)",
  "oklch(0.63 0.11 50)",
  "oklch(0.63 0.11 95)",
  "oklch(0.63 0.11 140)",
  "oklch(0.63 0.11 240)",
  "oklch(0.63 0.11 280)",
  "oklch(0.63 0.11 320)",
  "oklch(0.63 0.11 350)",
];

export function categoryColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** WCAG 相对亮度（0–1）。支持 hex（#rrggbb）与 oklch(L C H)，均线性化到 sRGB。 */
function relativeLuminance(color: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const channels = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(color);
  if (!oklch) return 0;
  const L = parseFloat(oklch[1]);
  const C = parseFloat(oklch[2]);
  const H = parseFloat(oklch[3]);
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  // Oklab → 线性 sRGB（Björn Ottosson 变换），越界分量裁剪到 [0,1]
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const clamp01 = (c: number) => Math.min(Math.max(c, 0), 1);
  const r = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

const DARK_TEXT_LUMINANCE = relativeLuminance("#111111");

/** 按 WCAG 对比度选择色块文字颜色：深色底用白字，浅色底用深字。入参支持 hex / oklch。 */
export function contrastText(color: string): "#fff" | "#111" {
  const l = relativeLuminance(color);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastDark = (l + 0.05) / (DARK_TEXT_LUMINANCE + 0.05);
  return contrastWhite >= contrastDark ? "#fff" : "#111";
}
