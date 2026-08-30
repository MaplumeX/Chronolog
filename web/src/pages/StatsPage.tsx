import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { enUS, zhCN } from "react-day-picker/locale";

import { ApiError, api, type Category, type RangeStats, type Tag } from "../api";
import { browserTz, formatDuration, paletteColor } from "../format";
import { localeFor } from "../i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** 后端 /api/stats/range 的区间上限（天）。 */
const MAX_RANGE_DAYS = 92;

type RangeKind = "today" | "week" | "month" | "custom";

/* ---------- 纯日历日期工具（"YYYY-MM-DD" 是日历标签，UTC 午夜运算无 DST 问题） ---------- */

/** "YYYY-MM-DD" → UTC 午夜 Date，仅用于纯日历运算/格式化。 */
function toDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 纯日历日期加减。 */
function shiftDate(date: string, days: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 归一化到所在 ISO 周的周一（与后端 weekBounds 的周一对齐）。 */
function toWeekStart(date: string): string {
  const d = toDate(date);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** tz 当地的今天（Intl 格式化，安全跨时区，勿用 toISOString().slice）。 */
function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 闭区间天数。 */
function countDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000) + 1;
}

/** "YYYY-MM-DD" → 本地午夜 Date（浏览器时区，供 Calendar 使用）。 */
function toLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date（本地午夜，来自 Calendar）→ "YYYY-MM-DD"。 */
function fromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "0.75rem",
};

export function StatsPage() {
  const { t, i18n } = useTranslation();
  const tz = browserTz();

  const [kind, setKind] = useState<RangeKind>("today");
  // tz 本地「今天」，轮询时重算；跨午夜保持打开时据此滚动到新的一天。
  const [todayKey, setTodayKey] = useState(() => todayIn(tz));
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [stats, setStats] = useState<RangeStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagId, setTagId] = useState<string | undefined>(undefined);
  // 分类聚合模式：独立（默认，与现状一致）或汇总（子分类时长并入父分类；仅影响 statsRange 请求）
  const [rollup, setRollup] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .categories()
      .then((res) => {
        if (!cancelled) setCategories(res.categories);
      })
      .catch(() => undefined);
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

  /** custom 档的校验问题（提示文案 key 已翻译）；null = 有效或非 custom 档。 */
  const customProblem = useMemo<string | null>(() => {
    if (kind !== "custom") return null;
    if (!customFrom || !customTo) return t("stats.customRange.incomplete");
    if (customFrom > customTo) return t("stats.customRange.invalid");
    if (countDays(customFrom, customTo) > MAX_RANGE_DAYS) return t("stats.customRange.tooLong");
    return null;
  }, [kind, customFrom, customTo, t]);

  /** 当前档位对应的查询区间（from/to 为 tz 本地日历日）；custom 无效时为 null（不发请求）。 */
  const query = useMemo(() => {
    const today = todayKey;
    if (kind === "today") return { from: today, to: today };
    if (kind === "week") {
      const ws = toWeekStart(today);
      return { from: ws, to: shiftDate(ws, 6) };
    }
    if (kind === "month") {
      const [y, m] = today.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDay)}` };
    }
    if (customProblem || !customFrom || !customTo) return null;
    return { from: customFrom, to: customTo };
  }, [kind, tz, todayKey, customFrom, customTo, customProblem]);

  useEffect(() => {
    if (!query) return;
    const { from, to } = query;
    let cancelled = false;
    async function load() {
      try {
        const next = await api.statsRange(tz, from, to, tagId, rollup);
        if (!cancelled) setStats(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("common.loadFailed"));
      }
    }
    setError("");
    // 今日档随轮询感知跨午夜：tick 时重算 tz 本地日期，变化则触发 query 重算。
    const rollToday = () =>
      setTodayKey((prev) => {
        const next = todayIn(tz);
        return next === prev ? prev : next;
      });
    void load();
    // 仅今日档轮询（数据随计时器实时变化）；历史范围数据不变，无轮询意义。
    if (kind !== "today") {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(() => {
      rollToday();
      void load();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tz, query, tagId, rollup, kind, t]);

  const selectedTag = tags.find((x) => x.id === tagId);
  const locale = localeFor(i18n.language);

  // 颜色查表：聚合数据只有 id/name，按 id 查页面已加载的分类/标签列表拿显式色；
  // 查不到或未显式设色时 paletteColor 回退名称 hash 色（与升级前视觉一致）
  const categoryColorOf = (categoryId: string, categoryName: string) =>
    paletteColor(categories.find((c) => c.id === categoryId)?.color ?? null, categoryName);
  const tagColorOf = (tagId: string | null, tagName: string | null) =>
    tagId ? paletteColor(tags.find((x) => x.id === tagId)?.color ?? null, tagName ?? "") : "var(--muted-foreground)";

  const totalSeconds = stats?.totalSeconds ?? 0;
  const maxCategory = Math.max(1, ...(stats?.categories.map((c) => c.seconds) ?? [1]));
  const maxTag = Math.max(1, ...(stats?.tags.map((x) => x.seconds) ?? [1]));

  const trendData = stats?.days.map((d) => ({ date: d.date, seconds: d.seconds })) ?? [];
  const pieData = stats?.categories.filter((c) => c.seconds > 0) ?? [];

  const formatDay = (date: string, opts: Intl.DateTimeFormatOptions) =>
    toDate(date).toLocaleDateString(locale, { timeZone: "UTC", ...opts });

  const trendTick = (date: string) => {
    const day = Number(date.slice(8, 10));
    return day === 1 ? formatDay(date, { month: "short", day: "numeric" }) : String(day);
  };

  const trendLabel = (date: string) => formatDay(date, { month: "short", day: "numeric", weekday: "short" });

  const rdpRange =
    customFrom && customTo
      ? { from: toLocalDate(customFrom), to: toLocalDate(customTo) }
      : customFrom
        ? { from: toLocalDate(customFrom) }
        : undefined;

  const customLabel =
    customFrom && customTo
      ? `${formatDay(customFrom, { month: "short", day: "numeric" })} – ${formatDay(customTo, { month: "short", day: "numeric" })}`
      : t("stats.customRange.select");

  const rangeKinds: { value: RangeKind; label: string }[] = [
    { value: "today", label: t("stats.range.today") },
    { value: "week", label: t("stats.range.week") },
    { value: "month", label: t("stats.range.month") },
    { value: "custom", label: t("stats.range.custom") },
  ];

  return (
    <div className="px-6 py-6">
      <div className="mb-4 rounded-lg border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{t("stats.totalLogged")}</p>
        <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
          {formatDuration(totalSeconds)}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Tabs value={kind} onValueChange={(v) => setKind(v as RangeKind)}>
          <TabsList>
            {rangeKinds.map((r) => (
              <TabsTrigger key={r.value} value={r.value}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {kind === "custom" ? (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2 font-normal">
                {customLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={rdpRange}
                defaultMonth={customFrom ? toLocalDate(customFrom) : undefined}
                locale={i18n.language === "zh" ? zhCN : enUS}
                onSelect={(range) => {
                  if (!range?.from) {
                    setCustomFrom(null);
                    setCustomTo(null);
                    return;
                  }
                  setCustomFrom(fromLocalDate(range.from));
                  setCustomTo(range.to ? fromLocalDate(range.to) : null);
                }}
              />
            </PopoverContent>
          </Popover>
        ) : null}

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2 rounded-full">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: selectedTag
                      ? paletteColor(selectedTag.color, selectedTag.name)
                      : "transparent",
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
                    style={{ background: paletteColor(tag.color, tag.name) }}
                  />
                  {tag.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {customProblem ? <p className="mb-3 text-sm text-destructive">{customProblem}</p> : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {stats && stats.totalSeconds === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("stats.emptyRange")}</p>
      ) : stats ? (
        <>
          <section className="mb-8">
            <p className="mb-2 text-sm text-muted-foreground">{t("stats.dailyTrend")}</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={trendTick}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tickMargin={8}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    width={36}
                    tickFormatter={(value) => `${Math.round(Number(value) / 3600)}h`}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(value) => formatDuration(Number(value))}
                    labelFormatter={(label) => trendLabel(String(label))}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
                  />
                  <Bar dataKey="seconds" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-2 flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{t("stats.byCategory")}</p>
              <div className="ml-auto flex overflow-hidden rounded-md border">
                <Button
                  type="button"
                  variant={rollup ? "ghost" : "secondary"}
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs"
                  onClick={() => setRollup(false)}
                >
                  {t("stats.rollup.independent")}
                </Button>
                <Button
                  type="button"
                  variant={rollup ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 rounded-none px-2 text-xs"
                  onClick={() => setRollup(true)}
                >
                  {t("stats.rollup.rolledUp")}
                </Button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              <div className="relative h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="seconds"
                      nameKey="categoryName"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((c) => (
                        <Cell key={c.categoryId} fill={categoryColorOf(c.categoryId, c.categoryName)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {formatDuration(totalSeconds)}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1 divide-y">
                {stats.categories.map((c) => (
                  <div
                    className="grid grid-cols-[minmax(0,7rem)_1fr_auto_auto] items-center gap-3 py-3 md:grid-cols-[160px_1fr_56px_88px]"
                    key={c.categoryId}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: categoryColorOf(c.categoryId, c.categoryName) }}
                      />
                      {c.categoryName}
                    </span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(c.seconds / maxCategory) * 100}%`,
                          background: categoryColorOf(c.categoryId, c.categoryName),
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
              </div>
            </div>
          </section>

          {stats.tags.length > 0 ? (
            <section>
              <p className="mb-2 text-sm text-muted-foreground">{t("stats.byTag")}</p>
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
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
