import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ApiError,
  api,
  type Category,
  type RangeStats,
  type Tag,
} from "../../api";
import { paletteColor } from "../../format";
import {
  countDays,
  monthBounds,
  shiftDate,
  todayIn,
  toWeekStart,
} from "./stats-utils";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomView } from "./CustomView";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import type { ViewTools } from "./DayView";

/** 后端 /api/stats/range 的区间上限（天）。 */
const MAX_RANGE_DAYS = 92;

type ViewKind = "day" | "week" | "month" | "custom";

const VIEWS: ViewKind[] = ["day", "week", "month", "custom"];

export function StatsPage(props: { tz: string }) {
  const { t } = useTranslation();
  const tz = props.tz;

  const [view, setView] = useState<ViewKind>("day");
  // tz 本地「今天」，轮询时重算；跨午夜保持打开时据此滚动到新的一天。
  const [todayKey, setTodayKey] = useState(() => todayIn(tz));
  // 各视图导航锚点：null = 跟随当前（今天/本周/本月）
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [monthAnchor, setMonthAnchor] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | undefined>(undefined);
  // 分类聚合模式：独立（默认）或汇总（子分类时长并入父分类；仅影响 statsRange 请求）
  const [rollup, setRollup] = useState(false);
  const [stats, setStats] = useState<RangeStats | null>(null);
  const [prevStats, setPrevStats] = useState<RangeStats | null>(null);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  // 请求缓存：cacheKey = from|to|tagId|rollup；视图切换/翻页时复用（环比本期/上期互换）
  const cacheRef = useRef(new Map<string, RangeStats>());
  // 异步竞态守卫：仅最后一次 effect 的结果可落盘
  const seqRef = useRef(0);

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
    if (view !== "custom") return null;
    if (!customFrom || !customTo) return t("stats.customRange.incomplete");
    if (customFrom > customTo) return t("stats.customRange.invalid");
    if (countDays(customFrom, customTo) > MAX_RANGE_DAYS)
      return t("stats.customRange.tooLong");
    return null;
  }, [view, customFrom, customTo, t]);

  /** 当前视图对应的查询区间（from/to 为 tz 本地日历日）；custom 无效时为 null（不发请求）。 */
  const query = useMemo(() => {
    if (view === "day") {
      const d = dayDate ?? todayKey;
      return { from: d, to: d };
    }
    if (view === "week") {
      const ws = weekStart ?? toWeekStart(todayKey);
      return { from: ws, to: shiftDate(ws, 6) };
    }
    if (view === "month") return monthBounds(monthAnchor ?? todayKey);
    if (customProblem || !customFrom || !customTo) return null;
    return { from: customFrom, to: customTo };
  }, [
    view,
    dayDate,
    weekStart,
    monthAnchor,
    todayKey,
    customFrom,
    customTo,
    customProblem,
  ]);

  /** 上一期查询区间（周/月视图环比用）；其余视图为 null。 */
  const prevQuery = useMemo(() => {
    if (!query) return null;
    if (view === "week") {
      return { from: shiftDate(query.from, -7), to: shiftDate(query.to, -7) };
    }
    if (view === "month") {
      // 上月锚点 = 本月 1 日的前一天（落在上个月内）
      return monthBounds(shiftDate(query.from, -1));
    }
    return null;
  }, [view, query]);

  /** 是否正在查看「日视图 + 今天」（决定 5s 轮询）。 */
  const isToday = view === "day" && (dayDate ?? todayKey) === todayKey;

  useEffect(() => {
    if (!query) return;
    const { from, to } = query;
    const seq = ++seqRef.current;
    const keyOf = (f: string, tt: string) =>
      `${f}|${tt}|${tagId ?? ""}|${rollup}`;
    async function load(
      f: string,
      tt: string,
      force: boolean,
    ): Promise<RangeStats> {
      const key = keyOf(f, tt);
      if (!force) {
        const hit = cacheRef.current.get(key);
        if (hit) return hit;
      }
      const next = await api.statsRange(tz, f, tt, tagId, rollup);
      cacheRef.current.set(key, next);
      return next;
    }
    async function run(force: boolean) {
      try {
        const cur = await load(from, to, force);
        if (seq !== seqRef.current) return;
        setStats(cur);
        if (prevQuery) {
          try {
            const prev = await load(prevQuery.from, prevQuery.to, force);
            if (seq !== seqRef.current) return;
            setPrevStats(prev);
          } catch {
            if (seq === seqRef.current) setPrevStats(null);
          }
        } else if (seq === seqRef.current) {
          setPrevStats(null);
        }
      } catch (err) {
        if (seq === seqRef.current) {
          setError(
            err instanceof ApiError ? err.message : t("common.loadFailed"),
          );
        }
      }
    }
    setError("");
    // 先用缓存即时呈现（无缓存则清空等待加载）
    setStats(cacheRef.current.get(keyOf(from, to)) ?? null);
    setPrevStats(
      prevQuery
        ? (cacheRef.current.get(keyOf(prevQuery.from, prevQuery.to)) ?? null)
        : null,
    );
    void run(false);
    // 今日档随轮询感知跨午夜：tick 时重算 tz 本地日期，变化则触发 query 重算。
    const rollToday = () =>
      setTodayKey((prev) => {
        const next = todayIn(tz);
        return next === prev ? prev : next;
      });
    // 仅「日视图 + 今天」轮询（数据随计时器实时变化）；其余视图数据不变，无轮询意义。
    if (!isToday) return;
    const id = setInterval(() => {
      rollToday();
      void run(true); // 轮询绕过缓存强制刷新
    }, 5000);
    return () => {
      clearInterval(id);
    };
  }, [tz, view, query, prevQuery, tagId, rollup, isToday, t]);

  const selectedTag = tags.find((x) => x.id === tagId);

  // 颜色查表：分类/标签的显式色（子视图经 tools 消费原始列表自行查表）
  const tools: ViewTools = {
    categories,
    tags,
    tagId,
    rollup,
    onRollupChange: setRollup,
  };

  return (
    <PageContainer size="wide">
      {/* 工具栏行：view Tabs + ml-auto tag 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewKind)}>
          <TabsList>
            {VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {t(`stats.view.${v}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full"
              >
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

      {customProblem ? (
        <p className="mb-3 text-sm text-destructive">{customProblem}</p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className="space-y-6">
        {view === "day" ? (
          <DayView
            tz={tz}
            date={dayDate ?? todayKey}
            isToday={isToday}
            stats={stats}
            tools={tools}
            onNavigate={setDayDate}
          />
        ) : null}
        {view === "week" ? (
          <WeekView
            tz={tz}
            weekStart={weekStart ?? toWeekStart(todayKey)}
            stats={stats}
            prevStats={prevStats}
            tools={tools}
            onNavigate={setWeekStart}
          />
        ) : null}
        {view === "month" ? (
          <MonthView
            tz={tz}
            monthAnchor={monthAnchor ?? todayKey}
            stats={stats}
            prevStats={prevStats}
            tools={tools}
            onNavigate={setMonthAnchor}
          />
        ) : null}
        {view === "custom" ? (
          <CustomView
            tz={tz}
            from={customFrom ?? ""}
            to={customTo ?? ""}
            stats={stats}
            tools={tools}
            onRangeChange={(f, tt) => {
              setCustomFrom(f);
              setCustomTo(tt);
            }}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}
