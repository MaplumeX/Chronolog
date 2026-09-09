import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { enUS, zhCN } from "react-day-picker/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { ApiError, api, type TodayEntries } from "../../api";
import { formatDuration, paletteColor } from "../../format";
import { localeFor } from "../../i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DayRingChart,
  UNLOGGED_COLOR,
  buildRingSegments,
} from "./DayRingChart";
import { useNowMs } from "./now";
import {
  NULL_CATEGORY_KEY,
  hourlyByCategory,
  shiftDate,
  toLocalDate,
  todayIn,
} from "./stats-utils";

export type ViewTools = {
  /** 分类列表（显式色查表；为子视图提供颜色） */
  categories: {
    id: string;
    name: string;
    color: number | null;
    parentId: string | null;
  }[];
  /** 标签列表（显式色查表） */
  tags: { id: string; color: number | null }[];
  /** 当前 tag 筛选（undefined = 全部） */
  tagId: string | undefined;
  /** 分类聚合模式：独立（默认）或汇总（子分类时长并入父分类） */
  rollup: boolean;
  /** 切换聚合模式（子视图的分类构成卡 header 里渲染分段切换） */
  onRollupChange: (rollup: boolean) => void;
};

export type DayViewProps = {
  tz: string;
  /** 所查看的 tz 本地日期（"YYYY-MM-DD"） */
  date: string;
  /** 是否正在查看今天（决定子视图内部提示等；轮询由容器负责） */
  isToday: boolean;
  /** 容器加载的区间统计（日视图不用；条目数据由本视图自取） */
  stats: unknown;
  tools: ViewTools;
  onNavigate: (date: string) => void;
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "0.75rem",
};

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 23];

/** 日视图：24h 环形图（当日结构）+ 时段分布堆叠柱 + 分类构成列表。 */
export function DayView(props: DayViewProps) {
  const { t, i18n } = useTranslation();
  const { tz, date, isToday, tools } = props;
  const [entries, setEntries] = useState<TodayEntries | null>(null);
  const [error, setError] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // 今天：秒级时钟驱动运行中条目弧段/覆盖度实时生长；历史日期固定。
  const nowMs = useNowMs(isToday);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    api
      .todayEntries(tz, date, tools.tagId)
      .then((res) => {
        if (!cancelled) setEntries(res);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof ApiError ? err.message : t("common.loadFailed"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [tz, date, tools.tagId, t]);

  // rollup=true 时把子分类条目归并到父分类（服务器端 statsRange 语义的前端等价物：
  // /api/entries/today 不支持 rollup，条目级归并由这里完成）
  const parentOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of tools.categories) {
      if (c.parentId) map.set(c.id, c.parentId);
    }
    return map;
  }, [tools.categories]);

  const effectiveEntries = useMemo(() => {
    if (!entries) return [];
    if (!tools.rollup) return entries.entries;
    const byId = new Map(tools.categories.map((c) => [c.id, c]));
    return entries.entries.map((e) => {
      if (!e.categoryId) return e;
      let id = e.categoryId;
      // 层级最多两层，一次归并足够
      const parentId = parentOf.get(id);
      if (parentId) id = parentId;
      if (id === e.categoryId) return e;
      const parent = byId.get(id);
      return {
        ...e,
        categoryId: id,
        categoryName: parent?.name ?? e.categoryName,
      };
    });
  }, [entries, tools.rollup, tools.categories, parentOf]);

  const categoryColorOf = (categoryId: string | null, categoryName: string) =>
    paletteColor(
      tools.categories.find((c) => c.id === categoryId)?.color ?? null,
      categoryName,
    );

  const hourly = useMemo(
    () => hourlyByCategory(effectiveEntries, tz, date, nowMs),
    [effectiveEntries, tz, date, nowMs],
  );

  const segments = useMemo(
    () =>
      buildRingSegments(
        effectiveEntries,
        hourly.dayStartMs,
        hourly.dayEndMs,
        nowMs,
        categoryColorOf,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      effectiveEntries,
      hourly.dayStartMs,
      hourly.dayEndMs,
      nowMs,
      tools.categories,
    ],
  );

  /* ---------- 分类构成列表 ---------- */

  const composition = useMemo(() => {
    const totals = new Map<string, { name: string; seconds: number }>();
    for (const b of hourly.hours) {
      for (const [key, seconds] of Object.entries(b.categories)) {
        const cur = totals.get(key) ?? {
          name: hourly.categoryNames[key] ?? key,
          seconds: 0,
        };
        cur.seconds += seconds;
        totals.set(key, cur);
      }
    }
    const rows = [...totals.entries()].map(([key, v]) => ({
      key,
      name: v.name,
      seconds: v.seconds,
      color: categoryColorOf(key === NULL_CATEGORY_KEY ? null : key, v.name),
    }));
    rows.sort((a, b) => b.seconds - a.seconds);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourly, tools.categories]);

  const unloggedSeconds = Math.max(
    0,
    hourly.windowSeconds - hourly.coveredSeconds,
  );
  const maxRow = Math.max(
    1,
    ...composition.map((r) => r.seconds),
    unloggedSeconds,
  );

  /* ---------- 导航 ---------- */

  const locale = localeFor(i18n.language);
  const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m] = d.split("-").map(Number);
    return new Date(
      Date.UTC(y, m - 1, Number(d.slice(8, 10))),
    ).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
  };
  const label = isToday
    ? t("timeline.today")
    : fmtDay(date, { month: "long", day: "numeric", weekday: "short" });

  const navigate = (days: number) => props.onNavigate(shiftDate(date, days));

  /* ---------- 时段堆叠柱数据 ---------- */

  const stackKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const b of hourly.hours)
      for (const k of Object.keys(b.categories)) keys.add(k);
    keys.add("unlogged");
    return [...keys];
  }, [hourly]);

  const barData = hourly.hours.map((b) => ({
    hour: b.hour,
    ...Object.fromEntries(Object.entries(b.categories)),
    unlogged: b.unlogged,
  }));

  return (
    <div className="space-y-6">
      {/* 日期导航 */}
      <div className="flex items-center gap-2">
        <div className="flex items-stretch overflow-hidden rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative rounded-none rounded-l-md hover:bg-transparent dark:hover:bg-transparent cursor-pointer touch-hit--x"
            aria-label={t("timeline.prev")}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-40 justify-center rounded-none border-x px-2 font-semibold tabular-nums hover:bg-transparent dark:hover:bg-transparent cursor-pointer"
              >
                <span className="truncate">{label}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={toLocalDate(date)}
                defaultMonth={toLocalDate(date)}
                locale={i18n.language === "zh" ? zhCN : enUS}
                onSelect={(day) => {
                  if (!day) return;
                  setCalendarOpen(false);
                  props.onNavigate(
                    `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
                  );
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative rounded-none rounded-r-md hover:bg-transparent dark:hover:bg-transparent cursor-pointer touch-hit--x"
            aria-label={t("timeline.next")}
            onClick={() => navigate(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {!isToday ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => props.onNavigate(todayIn(tz))}
          >
            {t("timeline.backToToday")}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {entries ? (
        <>
          {/* 24h 环形图 + 分类构成列表 */}
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <CardTitle>{t("stats.categoryComposition")}</CardTitle>
              <div className="ml-auto flex overflow-hidden rounded-md border">
                <Button
                  type="button"
                  variant={tools.rollup ? "ghost" : "secondary"}
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs"
                  onClick={() => tools.onRollupChange(false)}
                >
                  {t("stats.rollup.independent")}
                </Button>
                <Button
                  type="button"
                  variant={tools.rollup ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs"
                  onClick={() => tools.onRollupChange(true)}
                >
                  {t("stats.rollup.rolledUp")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex min-w-0 flex-col items-center gap-6 md:flex-row md:items-start">
                <DayRingChart
                  tz={tz}
                  segments={segments}
                  windowSeconds={hourly.windowSeconds}
                  coveredSeconds={hourly.coveredSeconds}
                />
                <div className="min-w-0 flex-1 divide-y">
                  {composition.map((row) => (
                    <div
                      className="grid grid-cols-[minmax(0,7rem)_1fr_auto_auto] items-center gap-3 py-3 md:grid-cols-[160px_1fr_56px_88px]"
                      key={row.key}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: row.color }}
                        />
                        {row.name}
                      </span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(row.seconds / maxRow) * 100}%`,
                            background: row.color,
                          }}
                        />
                      </div>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {Math.round((row.seconds / hourly.windowSeconds) * 100)}
                        %
                      </span>
                      <span className="text-right font-mono tabular-nums">
                        {formatDuration(row.seconds)}
                      </span>
                    </div>
                  ))}
                  {/* 未记录灰桶行（最后） */}
                  <div className="grid grid-cols-[minmax(0,7rem)_1fr_auto_auto] items-center gap-3 py-3 md:grid-cols-[160px_1fr_56px_88px]">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: UNLOGGED_COLOR }}
                      />
                      {t("stats.unlogged")}
                    </span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(unloggedSeconds / maxRow) * 100}%`,
                          background: UNLOGGED_COLOR,
                        }}
                      />
                    </div>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {Math.round(
                        (unloggedSeconds / hourly.windowSeconds) * 100,
                      )}
                      %
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {formatDuration(unloggedSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 时段分布堆叠柱 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("stats.hourlyDistribution")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => String(h)}
                      ticks={HOUR_TICKS}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      tickMargin={8}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div
                            className="px-2 py-1 text-xs"
                            style={TOOLTIP_STYLE}
                          >
                            <p className="font-semibold">{String(label)}:00</p>
                            {payload
                              .filter((p) => Number(p.value) > 0)
                              .sort((a, b) => Number(b.value) - Number(a.value))
                              .map((p) => {
                                const key = String(p.dataKey);
                                const isUnlogged = key === "unlogged";
                                const name = isUnlogged
                                  ? t("stats.unlogged")
                                  : (hourly.categoryNames[key] ?? key);
                                return (
                                  <p key={key}>
                                    {name} · {formatDuration(Number(p.value))}
                                  </p>
                                );
                              })}
                          </div>
                        );
                      }}
                    />
                    {stackKeys.map((key) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        stackId="day"
                        fill={
                          key === "unlogged"
                            ? UNLOGGED_COLOR
                            : categoryColorOf(
                                key === NULL_CATEGORY_KEY ? null : key,
                                hourly.categoryNames[key] ?? key,
                              )
                        }
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
