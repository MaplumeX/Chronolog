import { useEffect, useRef } from "react";
import type { TodayEntries } from "../api";
import { categoryColor, clipSeconds, formatClock, formatDayLabel, formatDuration } from "../format";

const HOURS = Array.from({ length: 25 }, (_, i) => i);

export function Timeline(props: {
  today: TodayEntries | null;
  nowMs: number;
  tz: string;
  dayTotal: number;
}) {
  const { today, nowMs, tz, dayTotal } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayStartMs = today ? Date.parse(today.dayStart) : 0;
  const dayEndMs = today ? Date.parse(today.dayEnd) : 0;
  const dayMs = dayEndMs - dayStartMs || 1;

  const posPercent = (t: number) =>
    Math.max(0, Math.min(100, ((t - dayStartMs) / dayMs) * 100));

  const nowTop = posPercent(nowMs);

  useEffect(() => {
    if (!today || !scrollRef.current) return;
    const el = scrollRef.current;
    const inner = el.scrollHeight;
    const target = (nowTop / 100) * inner - el.clientHeight / 2;
    el.scrollTop = Math.max(0, target);
    // 仅在 today 首次加载后滚动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today != null]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3 font-semibold">
        <span>{formatDayLabel(tz)}</span>
        <span className="font-mono text-sm font-medium tabular-nums">{formatDuration(dayTotal)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="timeline-inner">
          <div className="timeline-ruler">
            {HOURS.map((h) => (
              <div key={h} className="hour" style={{ top: `${(h / 24) * 100}%` }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div className="timeline-track">
            {HOURS.map((h) => (
              <div key={h} className="timeline-grid" style={{ top: `${(h / 24) * 100}%` }} />
            ))}

            {today && today.entries.length === 0 ? (
              <div className="timeline-empty-hint">今天还没有记录</div>
            ) : null}

            {today
              ? today.entries.map((e) => {
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
                    today.dayStart,
                    today.dayEnd,
                    nowMs,
                  );
                  const timeRange = `${formatClock(e.startedAt, tz)} – ${
                    e.stoppedAt ? formatClock(e.stoppedAt, tz) : "…"
                  }`;
                  const color = categoryColor(e.categoryName);
                  const desc = e.description || "无说明";

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

            <div className="now-line" style={{ top: `${nowTop}%` }}>
              <span className="now-label">{formatClock(new Date(nowMs).toISOString(), tz)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
