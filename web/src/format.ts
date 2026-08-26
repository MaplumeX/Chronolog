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
  return new Date(iso).toLocaleTimeString("zh-CN", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDayLabel(tz: string): string {
  const date = new Date().toLocaleDateString("zh-CN", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return `今天 · ${date}`;
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

const COLORS = [
  "#e07a3d",
  "#2a9d8f",
  "#4c6ef5",
  "#9b5de5",
  "#ef476f",
  "#118ab2",
  "#ffb703",
  "#40916c",
];

export function categoryColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** WCAG 相对亮度（0–1），按 sRGB 线性化。 */
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const channels = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

const DARK_TEXT_LUMINANCE = relativeLuminance("#111111");

/** 按 WCAG 对比度选择色块文字颜色：深色底用白字，浅色底用深字。 */
export function contrastText(hex: string): "#fff" | "#111" {
  const l = relativeLuminance(hex);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastDark = (l + 0.05) / (DARK_TEXT_LUMINANCE + 0.05);
  return contrastWhite >= contrastDark ? "#fff" : "#111";
}
