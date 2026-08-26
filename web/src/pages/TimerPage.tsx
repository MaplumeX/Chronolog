import { useEffect, useRef, useState } from "react";
import { ApiError, api, type Category, type TimeEntry, type TodayEntries } from "../api";
import {
  browserTz,
  categoryColor,
  clipSeconds,
  elapsedSeconds,
  formatClock,
  formatDayLabel,
  formatDuration,
} from "../format";

const HOURS = Array.from({ length: 25 }, (_, i) => i);

export function TimerPage(props: {
  nowMs: number;
  current: TimeEntry | null;
  onCurrent: (entry: TimeEntry | null) => void;
}) {
  const tz = browserTz();
  const [categories, setCategories] = useState<Category[]>([]);
  const [today, setToday] = useState<TodayEntries | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const [cats, entries, cur] = await Promise.all([
      api.categories(),
      api.todayEntries(tz),
      api.current(),
    ]);
    setCategories(cats.categories);
    setToday(entries);
    props.onCurrent(cur.entry);
    if (!categoryId && cur.entry) setCategoryId(cur.entry.categoryId);
    if (cur.entry) setDescription(cur.entry.description);
  }

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof ApiError ? err.message : "加载失败"));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = categories.find((c) => c.id === categoryId);
  const running = props.current;
  const elapsed = running ? elapsedSeconds(running.startedAt, props.nowMs) : 0;
  const runningClipped =
    running && today
      ? clipSeconds(running.startedAt, null, today.dayStart, today.dayEnd, props.nowMs)
      : 0;
  const dayTotal =
    (today?.entries
      .filter((e) => e.stoppedAt)
      .reduce(
        (s, e) => s + clipSeconds(e.startedAt, e.stoppedAt, today.dayStart, today.dayEnd, props.nowMs),
        0,
      ) ?? 0) + runningClipped;

  async function onToggle() {
    setError("");
    try {
      if (running) {
        await api.stop();
        props.onCurrent(null);
      } else {
        if (!categoryId) return;
        const { entry } = await api.start(categoryId, description);
        props.onCurrent(entry);
      }
      const entries = await api.todayEntries(tz);
      setToday(entries);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失败");
    }
  }

  return (
    <>
      <div className="timer-bar">
        <input
          className="desc-input"
          placeholder="你在做什么？"
          value={running ? running.description : description}
          onChange={(e) => {
            if (!running) setDescription(e.target.value);
          }}
          readOnly={Boolean(running)}
        />
        <div className="cat-picker" ref={menuRef}>
          <button
            type="button"
            className="cat-btn"
            onClick={() => !running && setOpen((v) => !v)}
            disabled={Boolean(running)}
          >
            <span
              className="dot"
              style={{ background: categoryColor(running?.categoryName ?? selected?.name ?? "") }}
            />
            {running?.categoryName ?? selected?.name ?? "选择分类"}
          </button>
          {open ? (
            <div className="menu">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === categoryId ? "active" : ""}
                  onClick={() => {
                    setCategoryId(c.id);
                    setOpen(false);
                  }}
                >
                  <span className="dot" style={{ background: categoryColor(c.name) }} />
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="elapsed">{formatDuration(elapsed)}</div>
        <button
          type="button"
          className={`round ${running ? "stop" : "play"}`}
          onClick={onToggle}
          disabled={!running && !categoryId}
          aria-label={running ? "停止" : "开始"}
        >
          {running ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M4 2.5v9l8-4.5-8-4.5z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <TimelineSection
        today={today}
        nowMs={props.nowMs}
        tz={tz}
        dayTotal={dayTotal}
        scrollRef={scrollRef}
      />
    </>
  );
}

function TimelineSection(props: {
  today: TodayEntries | null;
  nowMs: number;
  tz: string;
  dayTotal: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { today, nowMs, tz, dayTotal, scrollRef } = props;

  const dayStartMs = today ? Date.parse(today.dayStart) : 0;
  const dayEndMs = today ? Date.parse(today.dayEnd) : 0;
  const dayMs = dayEndMs - dayStartMs || 1;

  const posPercent = (t: number) =>
    Math.max(0, Math.min(100, ((t - dayStartMs) / dayMs) * 100));

  const nowTop = posPercent(nowMs);

  // 初始滚动到"现在"附近
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
    <section className="timeline-card">
      <div className="day-head">
        <span>{formatDayLabel(tz)}</span>
        <span className="sum">{formatDuration(dayTotal)}</span>
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-inner">
          {/* 小时刻度 */}
          <div className="timeline-ruler">
            {HOURS.map((h) => (
              <div
                key={h}
                className="hour"
                style={{ top: `${(h / 24) * 100}%` }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 色块轨道 */}
          <div className="timeline-track">
            {/* 小时网格线 */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="timeline-grid"
                style={{ top: `${(h / 24) * 100}%` }}
              />
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

            {/* 当前时间指示线 */}
            <div
              className="now-line"
              style={{ top: `${nowTop}%` }}
            >
              <span className="now-label">{formatClock(new Date(nowMs).toISOString(), tz)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
