import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TodayEntries, WeekEntries } from "../api";
import {
  categoryColor,
  clipSeconds,
  contrastText,
  formatClock,
  formatDayLabel,
  formatDuration,
  formatWeekLabel,
  formatWeekdayHeader,
} from "../format";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

const HOURS = Array.from({ length: 25 }, (_, i) => i);

function isDayAt(day: TodayEntries, nowMs: number): boolean {
  return nowMs >= Date.parse(day.dayStart) && nowMs < Date.parse(day.dayEnd);
}

/** 单日 24h 纵向时间线：ruler + track + blocks + now-line。day 与 week 模式共用。 */
function DayColumn(props: {
  day: TodayEntries | null;
  nowMs: number;
  tz: string;
  isToday: boolean;
  emptyHint?: string;
  showRuler?: boolean;
}) {
  const { t } = useTranslation();
  const { day, nowMs, tz, isToday, emptyHint, showRuler = true } = props;

  const dayStartMs = day ? Date.parse(day.dayStart) : 0;
  const dayEndMs = day ? Date.parse(day.dayEnd) : 0;
  const dayMs = dayEndMs - dayStartMs || 1;

  const posPercent = (t: number) =>
    Math.max(0, Math.min(100, ((t - dayStartMs) / dayMs) * 100));

  const nowTop = posPercent(nowMs);

  return (
    <div className="timeline-inner">
      {showRuler ? (
        <div className="timeline-ruler">
          {HOURS.map((h) => (
            <div key={h} className="hour" style={{ top: `${(h / 24) * 100}%` }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
      ) : null}

      <div className={`timeline-track${showRuler ? "" : " timeline-track--full"}`}>
        {HOURS.map((h) => (
          <div key={h} className="timeline-grid" style={{ top: `${(h / 24) * 100}%` }} />
        ))}

        {day && day.entries.length === 0 && emptyHint ? (
          <div className="timeline-empty-hint">{emptyHint}</div>
        ) : null}

        {day
          ? day.entries.map((e) => {
              const start = Date.parse(e.startedAt);
              const end = e.stoppedAt ? Date.parse(e.stoppedAt) : nowMs;
              const top = posPercent(start);
              const heightPct = Math.max(
                0,
                Math.min(100 - top, ((end - start) / dayMs) * 100),
              );
              const isRunning = !e.stoppedAt;
              const secs = clipSeconds(
                e.startedAt,
                e.stoppedAt,
                day.dayStart,
                day.dayEnd,
                nowMs,
              );
              const timeRange = `${formatClock(e.startedAt, tz)} – ${
                e.stoppedAt ? formatClock(e.stoppedAt, tz) : "…"
              }`;
              const color = categoryColor(e.categoryName);
              const textColor = contrastText(color);
              const desc = e.description || t("timeline.noDescription");

              let tier: "full" | "compact" | "mini";
              if (heightPct >= 2.5) tier = "full";
              else if (heightPct >= 1) tier = "compact";
              else tier = "mini";

              const title = `${desc} · ${e.categoryName} · ${timeRange} · ${formatDuration(secs)}`;

              return (
                <div
                  key={e.id}
                  className={`timeline-block ${tier}${isRunning ? " running" : ""}`}
                  style={{
                    top: `${top}%`,
                    height: `${heightPct}%`,
                    background: color,
                    color: textColor,
                  }}
                  title={title}
                >
                  {tier === "full" ? (
                    <>
                      <div className="block-desc">{desc}</div>
                      <div className="block-meta">{e.categoryName}</div>
                      <div className="block-time">{timeRange}</div>
                      <div className="block-dur">{formatDuration(secs)}</div>
                    </>
                  ) : tier === "compact" ? (
                    <>
                      <span className="block-desc">{desc}</span>
                      <span className="block-dur">{formatDuration(secs)}</span>
                    </>
                  ) : (
                    <span className="block-desc">{desc}</span>
                  )}
                </div>
              );
            })
          : null}

        {isToday ? (
          <div className="now-line" style={{ top: `${nowTop}%` }}>
            <span className="now-label">{formatClock(new Date(nowMs).toISOString(), tz)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Timeline(props: {
  today: TodayEntries | null;
  week: WeekEntries | null;
  mode: "day" | "week";
  onModeChange: (mode: "day" | "week") => void;
  nowMs: number;
  tz: string;
  dayTotal: number;
  weekTotal: number;
}) {
  const { t } = useTranslation();
  const { today, week, mode, onModeChange, nowMs, tz, dayTotal, weekTotal } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDay = mode === "day";

  // 滚动锚点：day 模式为当天；week 模式为 nowMs 所在的那一列
  const anchorDay = isDay
    ? today
    : (week?.days.find((d) => isDayAt(d, nowMs)) ?? null);

  const dayStartMs = anchorDay ? Date.parse(anchorDay.dayStart) : 0;
  const dayEndMs = anchorDay ? Date.parse(anchorDay.dayEnd) : 0;
  const dayMs = dayEndMs - dayStartMs || 1;
  const nowTop = Math.max(0, Math.min(100, ((nowMs - dayStartMs) / dayMs) * 100));

  useEffect(() => {
    if (!anchorDay || !scrollRef.current) return;
    const el = scrollRef.current;
    const inner = el.scrollHeight;
    const target = (nowTop / 100) * inner - el.clientHeight / 2;
    el.scrollTop = Math.max(0, target);
    // 仅在视图数据首次加载或切换视图后滚动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDay != null, mode]);

  const headerLabel = isDay
    ? formatDayLabel(tz)
    : week
      ? formatWeekLabel(week.weekStart, week.weekEnd, tz)
      : "";
  const total = isDay ? dayTotal : weekTotal;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Tabs
            value={mode}
            onValueChange={(v) => onModeChange(v === "week" ? "week" : "day")}
            aria-label={t("timeline.viewToggle")}
          >
            <TabsList>
              <TabsTrigger value="day">{t("timeline.viewDay")}</TabsTrigger>
              <TabsTrigger value="week">{t("timeline.viewWeek")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="truncate font-semibold">{headerLabel}</span>
        </div>
        <span className="font-mono text-sm font-medium tabular-nums">{formatDuration(total)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" ref={scrollRef}>
        {isDay ? (
          <DayColumn
            day={today}
            nowMs={nowMs}
            tz={tz}
            isToday
            emptyHint={t("timeline.empty")}
          />
        ) : week ? (
          <div className="flex min-w-full flex-col">
            <div className="flex">
              <div className="w-14 flex-shrink-0" />
              {week.days.map((d) => {
                const isToday = isDayAt(d, nowMs);
                const header = formatWeekdayHeader(d.dayStart, tz);
                return (
                  <div
                    key={d.dayStart}
                    className="flex min-w-[180px] flex-1 flex-col border-l"
                  >
                    <div
                      className={`border-b px-2 py-2 text-center${isToday ? " bg-primary/10" : ""}`}
                    >
                      <div
                        className={`text-2xl font-bold leading-tight${isToday ? " text-primary" : ""}`}
                      >
                        {header.day}
                      </div>
                      <div className="text-xs text-muted-foreground">{header.weekday}</div>
                      <div className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatDuration(d.totalClippedSeconds)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex">
              <div className="timeline-ruler timeline-ruler--static">
                {HOURS.map((h) => (
                  <div key={h} className="hour" style={{ top: `${(h / 24) * 100}%` }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {week.days.map((d) => (
                <div
                  key={d.dayStart}
                  className="flex min-w-[180px] flex-1 flex-col border-l"
                >
                  <DayColumn
                    day={d}
                    nowMs={nowMs}
                    tz={tz}
                    isToday={isDayAt(d, nowMs)}
                    showRuler={false}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
