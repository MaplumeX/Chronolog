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

      <section className="day-card">
        <div className="day-head">
          <span>{formatDayLabel(tz)}</span>
          <span className="sum">{formatDuration(dayTotal)}</span>
        </div>
        {!today || today.entries.length === 0 ? (
          <div className="empty">今天还没有记录</div>
        ) : (
          today.entries.map((e) => {
            const secs = clipSeconds(
              e.startedAt,
              e.stoppedAt,
              today.dayStart,
              today.dayEnd,
              props.nowMs,
            );
            return (
              <div className="row" key={e.id}>
                <span>{e.description || <span className="muted">无说明</span>}</span>
                <span className="pill">
                  <span className="dot" style={{ background: categoryColor(e.categoryName) }} />
                  {e.categoryName}
                </span>
                <span className="when">
                  {formatClock(e.startedAt, tz)} – {e.stoppedAt ? formatClock(e.stoppedAt, tz) : "…"}
                </span>
                <span className="dur">{formatDuration(secs)}</span>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
