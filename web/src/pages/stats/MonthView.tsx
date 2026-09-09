import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import type { RangeStats } from "../../api";
import { formatDuration, paletteColor } from "../../format";
import { localeFor } from "../../i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NULL_CATEGORY_KEY,
  coverageDays,
  countDays,
  dailyByCategory,
  deltaPercent,
  longestStreak,
  monthBounds,
  shiftDate,
  toDate,
  todayIn,
} from "./stats-utils";
import type { ViewTools } from "./DayView";

/** 热力图色阶：level 0 = muted 极浅（该分类当天 0 时长），1–4 = 分类色透明度阶梯。 */
const HEAT_LEVEL_MIX = [12, 32, 50, 68, 86];
/** level 0 用中性灰（该分类当天 0 时长，与分类色浅档区分）。 */
const HEAT_LEVEL_0 =
  "color-mix(in srgb, var(--muted-foreground) 12%, transparent)";
/** 完全无记录日的描边空格（token 派生）。 */
const EMPTY_DAY_BORDER =
  "color-mix(in srgb, var(--muted-foreground) 40%, transparent)";

export type MonthViewProps = {
  tz: string;
  /** 所查看月的任一天（"YYYY-MM-DD"，容器用其 monthBounds 求窗口） */
  monthAnchor: string;
  /** 本期数据 */
  stats: RangeStats | null;
  /** 上一期数据（上月，环比用；加载中为 null） */
  prevStats: RangeStats | null;
  tools: ViewTools;
  onNavigate: (monthAnchor: string) => void;
};

/** 当天该分类秒数 → 0–4 档（相对当月该分类最大值；0 → 0 档）。 */
function heatLevel(seconds: number, maxSeconds: number): number {
  if (seconds <= 0 || maxSeconds <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((seconds / maxSeconds) * 4)));
}

/** 月视图：分类可选日历热力图 + 记录纪律 KPI + 所选分类环比上月。 */
export function MonthView(props: MonthViewProps) {
  const { t, i18n } = useTranslation();
  const { tz, monthAnchor, stats, prevStats, tools } = props;
  // 热力图分类选择（本地状态；null = 未选/无数据，回退默认第一项）
  const [categoryKey, setCategoryKey] = useState<string | null>(null);

  const nowMs = Date.now();
  const today = todayIn(tz);
  const { from, to } = monthBounds(monthAnchor);
  const isCurrentMonth = monthBounds(today).from === from;

  const categoryColorOf = (categoryId: string | null, categoryName: string) =>
    paletteColor(
      tools.categories.find((c) => c.id === categoryId)?.color ?? null,
      categoryName,
    );

  /* ---------- 逐日 × 分类矩阵 ---------- */

  const daily = useMemo(() => {
    if (!stats) return null;
    return dailyByCategory(stats.entries, tz, stats.days, nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, tz]);

  /** 分类选择器列表：本期 categories 按时长降序；key = categoryId ?? NULL。 */
  const categoryOptions = useMemo(() => {
    if (!stats) return [];
    return [...stats.categories]
      .sort((a, b) => b.seconds - a.seconds)
      .map((c) => ({
        key: c.categoryId ?? NULL_CATEGORY_KEY,
        name: c.categoryName,
        seconds: c.seconds,
        color: categoryColorOf(c.categoryId, c.categoryName),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, tools.categories]);

  /** 有效选中：state 失效（翻月/换筛选后不在列表）回退第一项（占比最大分类）。 */
  const selected =
    categoryOptions.find((o) => o.key === categoryKey) ??
    categoryOptions[0] ??
    null;

  /* ---------- 热力图格子 ---------- */

  const cells = useMemo(() => {
    if (!stats || !daily) return null;
    const maxSeconds = selected
      ? Math.max(
          0,
          ...daily.days.map((d) => d.categories[selected.key] ?? 0),
        )
      : 0;
    // days 与 daily.days 同序同长（dailyByCategory 按 stats.days 生成）
    return daily.days.map((d, i) => {
      const seconds = selected ? (d.categories[selected.key] ?? 0) : 0;
      const future = d.date > today;
      return {
        date: d.date,
        day: Number(d.date.slice(8, 10)),
        /** 当天是否有任何记录（与 KPI 同源：days[i].seconds） */
        recorded: stats.days[i]?.seconds > 0,
        future,
        seconds,
        level: heatLevel(seconds, maxSeconds),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, daily, selected, today]);

  /** 月初前置空位（周一开头对齐）。 */
  const leadingBlanks = (toDate(from).getUTCDay() + 6) % 7;
  const trailingBlanks =
    cells ? (7 - ((leadingBlanks + cells.length) % 7)) % 7 : 0;

  const selectedColor = selected?.color ?? "";
  const cellBackground = (level: number) =>
    level === 0
      ? HEAT_LEVEL_0
      : `color-mix(in srgb, ${selectedColor} ${HEAT_LEVEL_MIX[level]}%, transparent)`;

  /* ---------- KPI ---------- */

  const coverage = useMemo(() => {
    if (!stats) return null;
    return coverageDays(stats.days, today, to);
  }, [stats, today, to]);

  const streak = useMemo(
    () => (stats ? longestStreak(stats.days) : 0),
    [stats],
  );

  const monthDayCount = countDays(from, to);
  const selectedTotal = selected?.seconds ?? 0;
  const selectedPrev = prevStats?.categories.find(
    (c) => (c.categoryId ?? NULL_CATEGORY_KEY) === selected?.key,
  )?.seconds;
  const selectedDelta = selected
    ? deltaPercent(selectedTotal, selectedPrev ?? 0)
    : null;

  /* ---------- 导航 ---------- */

  const locale = localeFor(i18n.language);
  const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m] = d.split("-").map(Number);
    return new Date(
      Date.UTC(y, m - 1, Number(d.slice(8, 10))),
    ).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
  };
  const monthLabel = fmtDay(from, { month: "long", year: "numeric" });
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        // from 所在周的周一 + i（纯日历标签，任意一个周一都行）
        const monday = new Date(toDate(from));
        monday.setUTCDate(monday.getUTCDate() - leadingBlanks + i);
        return monday.toLocaleDateString(locale, {
          timeZone: "UTC",
          weekday: "short",
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, leadingBlanks, locale],
  );

  const navigate = (months: number) =>
    props.onNavigate(
      months < 0 ? shiftDate(from, -1) : shiftDate(to, 1),
    );

  if (!stats || !daily || !cells || !coverage) {
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

  const deltaUp = selectedDelta !== null && selectedDelta > 0;
  const deltaDown = selectedDelta !== null && selectedDelta < 0;

  return (
    <div className="space-y-6">
      {/* 月导航 */}
      <div className="flex items-center gap-2">
        <div className="flex items-stretch overflow-hidden rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative rounded-none rounded-l-md hover:bg-transparent dark:hover:bg-transparent cursor-pointer touch-hit--x"
            aria-label={t("stats.month.prev")}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="flex min-w-40 items-center justify-center border-x px-2 text-sm font-semibold tabular-nums">
            <span className="truncate">{monthLabel}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative rounded-none rounded-r-md hover:bg-transparent dark:hover:bg-transparent cursor-pointer touch-hit--x"
            aria-label={t("stats.month.next")}
            onClick={() => navigate(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {!isCurrentMonth ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => props.onNavigate(today)}
          >
            {t("stats.month.backToCurrent")}
          </Button>
        ) : null}
      </div>

      {/* 记录纪律 KPI */}
      <Card>
        <CardHeader>
          <CardTitle>{t("stats.month.discipline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("stats.month.coverage")}
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {t("stats.month.coverageValue", {
                  recorded: coverage.recorded,
                  elapsed: coverage.elapsed,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("stats.month.streak")}
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {t("stats.month.streakValue", { count: streak })}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {selected ? (
                  <>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: selected.color }}
                    />
                    <span className="truncate">{selected.name}</span>
                  </>
                ) : (
                  t("stats.month.categoryTotal")
                )}
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                {formatDuration(selectedTotal)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {t("stats.month.dailyAverage", {
                  value: formatDuration(selectedTotal / monthDayCount),
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("stats.month.vsLastMonth")}
              </p>
              <p
                className={`mt-1 font-mono text-lg font-bold tabular-nums ${deltaUp ? "text-primary" : deltaDown ? "text-destructive" : "text-muted-foreground"}`}
              >
                {selectedDelta === null
                  ? "—"
                  : `${deltaUp ? "▲" : deltaDown ? "▼" : ""}${Math.abs(Math.round(selectedDelta))}%`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 分类可选热力图 */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <CardTitle>{t("stats.month.heatmap")}</CardTitle>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={categoryOptions.length === 0}
                >
                  {selected ? (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: selected.color }}
                    />
                  ) : null}
                  {selected
                    ? selected.name
                    : t("stats.month.noCategories")}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {categoryOptions.map((o) => (
                  <DropdownMenuItem
                    key={o.key}
                    onClick={() => setCategoryKey(o.key)}
                    className={selected?.key === o.key ? "bg-accent" : undefined}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: o.color }}
                    />
                    {o.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-[26rem]">
            {/* 星期表头（周一开头） */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {weekdayLabels.map((w) => (
                <span
                  key={w}
                  className="text-center text-[10px] text-muted-foreground"
                >
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} className="aspect-square" />
              ))}
              {cells.map((c) => {
                if (c.future) {
                  return (
                    <div
                      key={c.date}
                      aria-disabled="true"
                      className="relative flex aspect-square items-start justify-center rounded-sm bg-muted/50 pt-0.5 text-[10px] text-muted-foreground/40 tabular-nums"
                    >
                      {c.day}
                    </div>
                  );
                }
                if (!c.recorded) {
                  return (
                    <div
                      key={c.date}
                      title={`${fmtDay(c.date, { month: "short", day: "numeric" })} · ${t("stats.unlogged")}`}
                      className="relative flex aspect-square items-start justify-center rounded-sm border border-dashed pt-0.5 text-[10px] text-muted-foreground/60 tabular-nums"
                      style={{ borderColor: EMPTY_DAY_BORDER }}
                    >
                      {c.day}
                    </div>
                  );
                }
                return (
                  <div
                    key={c.date}
                    title={`${fmtDay(c.date, { month: "short", day: "numeric" })} · ${formatDuration(c.seconds)}`}
                    className="relative flex aspect-square items-start justify-center rounded-sm pt-0.5 text-[10px] text-muted-foreground tabular-nums"
                    style={{ background: cellBackground(c.level) }}
                  >
                    {c.day}
                  </div>
                );
              })}
              {Array.from({ length: trailingBlanks }, (_, i) => (
                <div key={`blank-end-${i}`} className="aspect-square" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
