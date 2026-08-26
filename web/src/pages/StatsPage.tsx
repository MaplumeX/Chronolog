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
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold">统计</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{formatDayLabel(tz)} · 按分类合计</p>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {!stats || stats.categories.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">今天还没有记录</p>
      ) : (
        <div className="divide-y">
          {stats.categories.map((c) => (
            <div
              className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 py-3 md:grid-cols-[160px_1fr_88px]"
              key={c.categoryId}
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: categoryColor(c.categoryName) }}
                />
                {c.categoryName}
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(c.seconds / max) * 100}%`,
                    background: categoryColor(c.categoryName),
                  }}
                />
              </div>
              <span className="text-right font-mono tabular-nums">{formatDuration(c.seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
