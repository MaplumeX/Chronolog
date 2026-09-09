import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { RangeStats } from "../../api";
import { formatDuration, paletteColor } from "../../format";
import { localeFor } from "../../i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StackedCompositionChart } from "./StackedCompositionChart";
import {
  NULL_CATEGORY_KEY,
  dailyByCategory,
  deltaPercent,
  shiftDate,
  todayIn,
  toWeekStart,
} from "./stats-utils";
import type { ViewTools } from "./DayView";

export type WeekViewProps = {
  tz: string;
  /** 所查看周的周一（"YYYY-MM-DD"） */
  weekStart: string;
  /** 本期数据 */
  stats: RangeStats | null;
  /** 上一期数据（上周，环比用；加载中为 null） */
  prevStats: RangeStats | null;
  tools: ViewTools;
  onNavigate: (weekStart: string) => void;
};

/** 周视图：每日归一化分类堆叠柱（7 柱，结构形态）+ 逐分类环比上周。 */
export function WeekView(props: WeekViewProps) {
  const { t, i18n } = useTranslation();
  const { tz, weekStart, stats, prevStats, tools } = props;

  const nowMs = Date.now();
  const isCurrentWeek = toWeekStart(todayIn(tz)) === toWeekStart(weekStart);

  const categoryColorOf = (categoryId: string | null, categoryName: string) =>
    paletteColor(
      tools.categories.find((c) => c.id === categoryId)?.color ?? null,
      categoryName,
    );

  /* ---------- 逐日 × 分类矩阵 ---------- */

  const daily = useMemo(() => {
    if (!stats) return null;
    const week = Array.from({ length: 7 }, (_, i) => ({
      date: shiftDate(weekStart, i),
    }));
    return dailyByCategory(stats.entries, tz, week, nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, tz, weekStart]);

  /** 堆叠层顺序：分类按本期周总时长降序，未记录固定最后（堆叠顶层）。 */
  const stackKeys = useMemo(() => {
    if (!daily) return [];
    const totals = new Map<string, number>();
    for (const d of daily.days) {
      for (const [key, seconds] of Object.entries(d.categories)) {
        totals.set(key, (totals.get(key) ?? 0) + seconds);
      }
    }
    const keys = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    return [...keys, "unlogged"];
  }, [daily]);

  /* ---------- 环比列表 ---------- */

  const deltaRows = useMemo(() => {
    if (!stats) return null;
    type Row = {
      key: string;
      name: string;
      current: number;
      previous: number;
      delta: number | null;
    };
    const currentByKey = new Map<string, Row>();
    for (const c of stats.categories) {
      const key = c.categoryId ?? NULL_CATEGORY_KEY;
      currentByKey.set(key, {
        key,
        name: c.categoryName,
        current: c.seconds,
        previous: 0,
        delta: null,
      });
    }
    for (const c of prevStats?.categories ?? []) {
      const key = c.categoryId ?? NULL_CATEGORY_KEY;
      const cur = currentByKey.get(key);
      if (cur) cur.previous = c.seconds;
      else
        currentByKey.set(key, {
          key,
          name: c.categoryName,
          current: 0,
          previous: c.seconds,
          delta: null,
        });
    }
    const rows = [...currentByKey.values()];
    for (const r of rows) r.delta = deltaPercent(r.current, r.previous);
    // 本期时长降序；上期独有（本期 0）排后面
    rows.sort((a, b) => b.current - a.current || b.previous - a.previous);
    return rows;
  }, [stats, prevStats]);

  /* ---------- 导航 ---------- */

  const locale = localeFor(i18n.language);
  const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m] = d.split("-").map(Number);
    return new Date(
      Date.UTC(y, m - 1, Number(d.slice(8, 10))),
    ).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
  };
  const label = `${fmtDay(weekStart, { month: "short", day: "numeric" })} – ${fmtDay(shiftDate(weekStart, 6), { month: "short", day: "numeric" })}`;
  const weekdayLabel = (d: string) =>
    fmtDay(d, { weekday: "short" }) + " " + fmtDay(d, { day: "numeric" });
  const navigate = (weeks: number) =>
    props.onNavigate(shiftDate(weekStart, weeks * 7));

  if (!stats || !daily) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            {t("common.loadFailed")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 周导航 */}
      <div className="flex items-center gap-2">
        <div className="flex items-stretch overflow-hidden rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative rounded-none rounded-l-md hover:bg-transparent dark:hover:bg-transparent cursor-pointer touch-hit--x"
            aria-label={t("stats.week.prev")}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="flex min-w-40 items-center justify-center border-x px-2 text-sm font-semibold tabular-nums">
            <span className="truncate">{label}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative rounded-none rounded-r-md hover:bg-transparent dark:hover:bg-transparent cursor-pointer touch-hit--x"
            aria-label={t("stats.week.next")}
            onClick={() => navigate(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {!isCurrentWeek ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => props.onNavigate(toWeekStart(todayIn(tz)))}
          >
            {t("stats.week.backToCurrent")}
          </Button>
        ) : null}
      </div>

      {/* 每日归一化分类堆叠柱 */}
      <StackedCompositionChart
        title={t("stats.week.composition")}
        daily={daily}
        stackKeys={stackKeys}
        categoryColorOf={categoryColorOf}
        xTickFormatter={(d) => weekdayLabel(d)}
        tooltipDateLabel={(d) =>
          fmtDay(d, { month: "short", day: "numeric", weekday: "short" })
        }
      />

      {/* 分类环比 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("stats.week.vsLastWeek")}</CardTitle>
        </CardHeader>
        <CardContent>
          {deltaRows && deltaRows.length > 0 ? (
            <div className="divide-y">
              {deltaRows.map((row) => {
                const up = row.delta !== null && row.delta > 0;
                const down = row.delta !== null && row.delta < 0;
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background: categoryColorOf(
                            row.key === NULL_CATEGORY_KEY ? null : row.key,
                            row.name,
                          ),
                        }}
                      />
                      {row.name}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {formatDuration(row.current)}
                    </span>
                    <span
                      className={`w-20 text-right font-mono tabular-nums ${up ? "text-primary" : down ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {row.delta === null
                        ? "—"
                        : `${up ? "▲" : down ? "▼" : ""}${Math.abs(Math.round(row.delta))}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("stats.emptyRange")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
