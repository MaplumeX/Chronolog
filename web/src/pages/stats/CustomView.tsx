import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { enUS, zhCN } from "react-day-picker/locale";
import type { DateRange } from "react-day-picker";

import type { RangeStats } from "../../api";
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
import { UNLOGGED_COLOR } from "./DayRingChart";
import { StackedCompositionChart } from "./StackedCompositionChart";
import {
  NULL_CATEGORY_KEY,
  dailyByCategory,
  fromLocalDate,
  toLocalDate,
} from "./stats-utils";
import type { ViewTools } from "./DayView";

/** X 轴抽稀阈值：超过该天数自动 preserveStartEnd。 */
const DENSE_BAR_THRESHOLD = 14;

/** 区间选择器（Popover + react-day-picker range 双月日历；无效/未选全时常驻可重新选择）。 */
function RangeSelector(props: {
  label: string;
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;
  rdpRange: DateRange | undefined;
  defaultMonth: Date | undefined;
  locale: typeof zhCN;
  onSelect: (range: DateRange | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Popover open={props.calendarOpen} onOpenChange={props.setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 font-normal"
          >
            {props.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-1rem)] p-0"
        >
          <Calendar
            mode="range"
            numberOfMonths={2}
            className="mx-auto"
            selected={props.rdpRange}
            defaultMonth={props.defaultMonth}
            locale={props.locale}
            onSelect={props.onSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export type CustomViewProps = {
  tz: string;
  /** 用户选择的区间（tz 本地日历日，闭区间；未选全时 from/to 为 ""） */
  from: string;
  to: string;
  stats: RangeStats | null;
  tools: ViewTools;
  /** 区间变更（来自子视图内的 Calendar 选择器） */
  onRangeChange: (from: string, to: string) => void;
};

/** 自定义视图：任意区间自由分析——逐日分类堆叠趋势 + 分类/标签分布。 */
export function CustomView(props: CustomViewProps) {
  const { t, i18n } = useTranslation();
  const { tz, from, to, stats, tools } = props;
  const [calendarOpen, setCalendarOpen] = useState(false);

  const nowMs = Date.now();

  const categoryColorOf = (categoryId: string | null, categoryName: string) =>
    paletteColor(
      tools.categories.find((c) => c.id === categoryId)?.color ?? null,
      categoryName,
    );
  const tagColorOf = (tagId: string | null, tagName: string | null) =>
    tagId
      ? paletteColor(
          tools.tags.find((x) => x.id === tagId)?.color ?? null,
          tagName ?? "",
        )
      : "var(--muted-foreground)";

  /* ---------- 逐日 × 分类矩阵（堆叠趋势） ---------- */

  const daily = useMemo(() => {
    if (!stats || !from || !to) return null;
    return dailyByCategory(stats.entries, tz, stats.days, nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, tz, from, to]);

  /** 堆叠层顺序：分类按区间总时长降序，未记录固定最后（堆叠顶层）。 */
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

  /* ---------- 分类构成列表（分母 = 区间总覆盖秒数） ---------- */

  const totalSeconds = stats?.totalSeconds ?? 0;
  const maxCategory = Math.max(
    1,
    ...(stats?.categories.map((c) => c.seconds) ?? [1]),
  );
  /** 未记录 = 区间窗口秒数 − 总覆盖。 */
  const unloggedSeconds = useMemo(() => {
    if (!daily) return 0;
    const windowSeconds = daily.days.reduce(
      (sum, d) => sum + d.windowSeconds,
      0,
    );
    const covered = daily.days.reduce((sum, d) => sum + d.coveredSeconds, 0);
    return Math.max(0, windowSeconds - covered);
  }, [daily]);
  const compositionMax = Math.max(maxCategory, unloggedSeconds || 1);

  /* ---------- 标签分布 ---------- */

  const maxTag = Math.max(
    1,
    ...(stats?.tags.map((x) => x.seconds) ?? [1]),
  );

  /* ---------- 区间选择器与文案 ---------- */

  const locale = localeFor(i18n.language);
  const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m] = d.split("-").map(Number);
    return new Date(
      Date.UTC(y, m - 1, Number(d.slice(8, 10))),
    ).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
  };
  const rangeLabel =
    from && to
      ? `${fmtDay(from, { month: "short", day: "numeric" })} – ${fmtDay(to, { month: "short", day: "numeric" })}`
      : t("stats.customRange.select");
  const rangeValid = Boolean(from && to && from <= to);

  const rdpRange =
    from && to
      ? { from: toLocalDate(from), to: toLocalDate(to) }
      : from
        ? { from: toLocalDate(from) }
        : undefined;

  /** X 轴刻度：1 号标注月份，其余仅日号（跨月区间可读）。 */
  const xTickFormatter = (d: string) => {
    const day = Number(d.slice(8, 10));
    return day === 1
      ? fmtDay(d, { month: "short", day: "numeric" })
      : String(day);
  };
  const tooltipDateLabel = (d: string) =>
    fmtDay(d, { month: "short", day: "numeric", weekday: "short" });

  if (!rangeValid || !stats || !daily) {
    return (
      <div className="space-y-6">
        <RangeSelector
          label={rangeLabel}
          calendarOpen={calendarOpen}
          setCalendarOpen={setCalendarOpen}
          rdpRange={rdpRange}
          defaultMonth={from ? toLocalDate(from) : undefined}
          locale={i18n.language === "zh" ? zhCN : enUS}
          onSelect={(range) => {
            if (!range?.from) {
              props.onRangeChange("", "");
              return;
            }
            props.onRangeChange(
              fromLocalDate(range.from),
              range.to ? fromLocalDate(range.to) : "",
            );
          }}
        />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {t("stats.customRange.placeholder")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 区间选择器 + 天数摘要 */}
      <div className="flex items-center gap-2">
        <RangeSelector
          label={rangeLabel}
          calendarOpen={calendarOpen}
          setCalendarOpen={setCalendarOpen}
          rdpRange={rdpRange}
          defaultMonth={from ? toLocalDate(from) : undefined}
          locale={i18n.language === "zh" ? zhCN : enUS}
          onSelect={(range) => {
            if (!range?.from) {
              props.onRangeChange("", "");
              return;
            }
            props.onRangeChange(
              fromLocalDate(range.from),
              range.to ? fromLocalDate(range.to) : "",
            );
          }}
        />
        {stats.days.length > 1 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("stats.customRange.dayCount", { count: stats.days.length })}
          </span>
        ) : null}
      </div>

      {/* 逐日分类堆叠趋势 */}
      <StackedCompositionChart
        title={t("stats.custom.trend")}
        daily={daily}
        stackKeys={stackKeys}
        categoryColorOf={categoryColorOf}
        xTickFormatter={xTickFormatter}
        tooltipDateLabel={tooltipDateLabel}
        interval={
          stats.days.length > DENSE_BAR_THRESHOLD
            ? "preserveStartEnd"
            : undefined
        }
        heightClassName={
          stats.days.length > DENSE_BAR_THRESHOLD ? "h-56" : "h-64"
        }
      />

      {/* 分类构成列表（含未记录行） */}
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
          <div className="divide-y">
            {(stats.categories.length > 0 || unloggedSeconds > 0) && (
              <>
                {stats.categories.map((c) => (
                  <div
                    className="grid grid-cols-[minmax(0,7rem)_1fr_auto_auto] items-center gap-3 py-3 md:grid-cols-[160px_1fr_56px_88px]"
                    key={c.categoryId ?? NULL_CATEGORY_KEY}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background: categoryColorOf(
                            c.categoryId,
                            c.categoryName,
                          ),
                        }}
                      />
                      {c.categoryName}
                    </span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(c.seconds / compositionMax) * 100}%`,
                          background: categoryColorOf(
                            c.categoryId,
                            c.categoryName,
                          ),
                        }}
                      />
                    </div>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {totalSeconds > 0
                        ? `${Math.round((c.seconds / totalSeconds) * 100)}%`
                        : "0%"}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {formatDuration(c.seconds)}
                    </span>
                  </div>
                ))}
                {/* 未记录灰桶行（最后；分母 = 区间总覆盖秒数） */}
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
                        width: `${(unloggedSeconds / compositionMax) * 100}%`,
                        background: UNLOGGED_COLOR,
                      }}
                    />
                  </div>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {totalSeconds > 0
                      ? `${Math.round((unloggedSeconds / totalSeconds) * 100)}%`
                      : "0%"}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    {formatDuration(unloggedSeconds)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 标签分布（不显示合计：多标签条目全额重复计数） */}
      {stats.tags.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("stats.byTag")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {stats.tags.map((x) => (
                <div
                  className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 py-3 md:grid-cols-[160px_1fr_88px]"
                  key={x.tagId ?? "none"}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: tagColorOf(x.tagId, x.tagName) }}
                    />
                    {x.tagId ? x.tagName : t("stats.noTag")}
                  </span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(x.seconds / maxTag) * 100}%`,
                        background: tagColorOf(x.tagId, x.tagName),
                      }}
                    />
                  </div>
                  <span className="text-right font-mono tabular-nums">
                    {formatDuration(x.seconds)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
