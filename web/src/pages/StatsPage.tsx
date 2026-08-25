import { useEffect, useState } from "react";
import { ApiError, api, type TodayStats } from "../api";
import { browserTz, categoryColor, formatDayLabel, formatDuration } from "../format";

export function StatsPage() {
  const tz = browserTz();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await api.todayStats(tz);
        if (!cancelled) setStats(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "加载失败");
      }
    }
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tz]);

  const max = Math.max(1, ...(stats?.categories.map((c) => c.seconds) ?? [1]));

  return (
    <>
      <h1 className="page-title">统计</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        {formatDayLabel(tz)} · 按分类合计
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="stats-card">
        {!stats || stats.categories.length === 0 ? (
          <div className="empty">今天还没有记录</div>
        ) : (
          stats.categories.map((c) => (
            <div className="stat-row" key={c.categoryId}>
              <span className="inline">
                <span className="dot" style={{ background: categoryColor(c.categoryName) }} />
                {c.categoryName}
              </span>
              <div className="bar">
                <span
                  style={{
                    width: `${(c.seconds / max) * 100}%`,
                    background: categoryColor(c.categoryName),
                  }}
                />
              </div>
              <span className="stat-secs">{formatDuration(c.seconds)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
