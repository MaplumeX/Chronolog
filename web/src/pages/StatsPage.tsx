import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Tag, type TodayStats } from "../api";
import { browserTz, categoryColor, formatDayLabel, formatDuration } from "../format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StatsPage() {
  const { t } = useTranslation();
  const tz = browserTz();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagId, setTagId] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await api.todayStats(tz, tagId);
        if (!cancelled) setStats(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("common.loadFailed"));
      }
    }
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tz, tagId]);

  useEffect(() => {
    let cancelled = false;
    api
      .tags()
      .then((res) => {
        if (!cancelled) setTags(res.tags);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTag = tags.find((x) => x.id === tagId);
  const max = Math.max(1, ...(stats?.categories.map((c) => c.seconds) ?? [1]));

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold">{t("nav.stats")}</h1>
      <div className="mt-1 mb-4 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {formatDayLabel(tz)} · {t("stats.byCategory")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2 rounded-full">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  background: selectedTag ? categoryColor(selectedTag.name) : "transparent",
                }}
              />
              {selectedTag ? selectedTag.name : t("stats.allTags")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setTagId(undefined)}
              className={tagId === undefined ? "bg-accent" : undefined}
            >
              {t("stats.allTags")}
            </DropdownMenuItem>
            {tags.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => setTagId(tag.id)}
                className={tag.id === tagId ? "bg-accent" : undefined}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: categoryColor(tag.name) }}
                />
                {tag.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {!stats || stats.categories.length === 0 ? null : (
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
