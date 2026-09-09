import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { TimeEntry } from "../../api";
import { formatClock, formatDuration } from "../../format";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "0.75rem",
};

/** 未记录弧段颜色（token 派生：muted-foreground 半透明）。 */
export const UNLOGGED_COLOR =
  "color-mix(in srgb, var(--muted-foreground) 45%, transparent)";

export type RingSegment = {
  key: string;
  /** 弧段时长（秒；用于占比） */
  seconds: number;
  /** 分类名（null = 未记录弧段） */
  categoryName: string | null;
  /** 弧段颜色（token / color-mix 表达） */
  color: string;
  /** 起止（ms，用于 tooltip HH:MM–HH:MM；未记录弧段用间隙边界） */
  startMs: number;
  endMs: number;
};

/**
 * 当日条目（含跨午夜裁剪到当日窗口的）+ 未记录间隙 → 按时间顺序的弧段序列。
 * 颜色查表由调用方传入（categoryId → color），未记录弧段灰。
 * 运行中条目右端取 nowMs（已在小时聚合语义里一致使用）。
 */
export function buildRingSegments(
  entries: TimeEntry[],
  dayStartMs: number,
  dayEndMs: number,
  nowMs: number,
  colorOf: (categoryId: string | null, categoryName: string) => string,
): RingSegment[] {
  type Clipped = {
    startMs: number;
    endMs: number;
    categoryId: string | null;
    categoryName: string;
  };
  const clipped: Clipped[] = [];
  for (const e of entries) {
    const s = Math.max(Date.parse(e.startedAt), dayStartMs);
    const end = Math.min(
      e.stoppedAt !== null ? Date.parse(e.stoppedAt) : nowMs,
      dayEndMs,
    );
    if (end > s)
      clipped.push({
        startMs: s,
        endMs: end,
        categoryId: e.categoryId,
        categoryName: e.categoryName,
      });
  }
  clipped.sort((a, b) => a.startMs - b.startMs);

  const segments: RingSegment[] = [];
  let cursor = dayStartMs;
  const pushUnlogged = (from: number, to: number) => {
    if (to - from > 0) {
      segments.push({
        key: `unlogged-${from}`,
        seconds: (to - from) / 1000,
        categoryName: null,
        color: UNLOGGED_COLOR,
        startMs: from,
        endMs: to,
      });
    }
  };

  let idx = 0;
  while (idx < clipped.length) {
    const c = clipped[idx];
    if (c.startMs > cursor) pushUnlogged(cursor, c.startMs);
    // 相邻同分类弧段合并（避免同色紧邻扇区缝隙）
    let end = c.endMs;
    const { categoryId, categoryName } = c;
    const startMs = c.startMs;
    while (idx + 1 < clipped.length && clipped[idx + 1].startMs <= end) {
      const next = clipped[idx + 1];
      if (next.categoryId !== categoryId) break;
      end = Math.max(end, next.endMs);
      idx++;
    }
    segments.push({
      key: `seg-${startMs}-${categoryId ?? ""}`,
      seconds: (end - startMs) / 1000,
      categoryName,
      color: colorOf(categoryId, categoryName),
      startMs,
      endMs: end,
    });
    cursor = Math.max(cursor, end);
    idx++;
  }
  if (dayEndMs > cursor) pushUnlogged(cursor, dayEndMs);
  return segments;
}

export type DayRingChartProps = {
  tz: string;
  segments: RingSegment[];
  /** 日窗口秒数（DST 日 ≠ 86400）；中心覆盖度分母 */
  windowSeconds: number;
  /** 已覆盖秒数（中心分子） */
  coveredSeconds: number;
};

/**
 * 24h 环形图：0 点在顶（12 点钟方向）、顺时针一整圈代表一天。
 * recharts PieChart 极坐标方案：startAngle=90（顶）→ endAngle=-270（视觉顺时针一整圈，
 * recharts 为数学角逆时针为正），每弧段一个 Cell，占比 = 秒数/日窗口秒数，
 * 数据按时间序排列即从 0 点起顺时针。中心覆盖度 `23h10m / 24h` 用绝对定位覆盖层。
 */
export function DayRingChart(props: DayRingChartProps) {
  const { t } = useTranslation();
  const { tz, segments, windowSeconds, coveredSeconds } = props;

  const data = segments.map((s) => ({
    key: s.key,
    seconds: Math.max(s.seconds, 1), // recharts 零值扇区不渲染，下限 1s
    segment: s,
  }));

  const formatRange = (ms: number) =>
    formatClock(new Date(ms).toISOString(), tz);

  return (
    <div className="relative h-64 w-64 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="seconds"
            nameKey="key"
            // recharts 极坐标是数学角（逆时针为正）：angle=90 是顶部；
            // 视觉顺时针 = 角度递减，故 startAngle=90（0 点在顶）→ endAngle=-270（顺时针一整圈）。
            // 第一个数据段从 startAngle 起、后续段顺次相接——数据已按时间序排列，即 0 点起顺时针。
            startAngle={90}
            endAngle={-270}
            innerRadius={72}
            outerRadius={100}
            isAnimationActive={false}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.segment.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const seg = payload[0].payload.segment as RingSegment;
              const name = seg.categoryName ?? t("stats.ringSegment.unlogged");
              return (
                <div className="px-2 py-1 text-xs" style={TOOLTIP_STYLE}>
                  {formatRange(seg.startMs)} – {formatRange(seg.endMs)} · {name}
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">
          {t("stats.coverage")}
        </span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {formatDuration(coveredSeconds)}
        </span>
        <span className="text-xs text-muted-foreground">
          / {Math.round(windowSeconds / 3600)}h
        </span>
      </div>
    </div>
  );
}
