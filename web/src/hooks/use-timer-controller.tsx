import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  api,
  type Category,
  type Tag,
  type TimeEntry,
  type TodayEntries,
  type WeekEntries,
} from "../api";
import { CategoryPicker } from "../components/CategoryPicker";
import { TagPicker } from "../components/TagPicker";
import { browserTz, clipSeconds, elapsedSeconds } from "../format";

const DATE_VIEW_KEY = "chronolog-date-view";

/** localStorage 读取查看的日期（"YYYY-MM-DD" | null = 今天），隐私模式下静默降级；垃圾值视为今天。 */
function loadDateView(): string | null {
  try {
    const v = window.localStorage.getItem(DATE_VIEW_KEY);
    return v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function saveDateView(date: string | null): void {
  try {
    if (date === null) window.localStorage.removeItem(DATE_VIEW_KEY);
    else window.localStorage.setItem(DATE_VIEW_KEY, date);
  } catch {
    // ignore
  }
}

/**
 * Timer 页全部状态与动作（原 TimerPage 逻辑原样迁移）。
 * TimerBar 位于 Shell 顶栏、Timeline 位于内容区，两者通过本 hook 共享状态。
 *
 * `enabled`：App 在顶层无条件调用本 hook（保证 hook 规则），未登录或不在 Timer 页时
 * 传 false 跳过数据加载。
 */
export function useTimerController(props: {
  nowMs: number;
  current: TimeEntry | null;
  onCurrent: (entry: TimeEntry | null) => void;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const tz = browserTz();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [today, setToday] = useState<TodayEntries | null>(null);
  const [week, setWeek] = useState<WeekEntries | null>(null);
  const [view, setView] = useState<"day" | "week">("day");
  // "YYYY-MM-DD" | null；null = 今天（默认）。查看的日期，day/week 视图共用
  const [date, setDate] = useState<string | null>(loadDateView);
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [cats, tagRes, entries, cur] = await Promise.all([
      api.categories(),
      api.tags(),
      api.todayEntries(tz, date ?? undefined),
      api.current(),
    ]);
    setCategories(cats.categories);
    setTags(tagRes.tags);
    setToday(entries);
    props.onCurrent(cur.entry);
    if (!categoryId && cur.entry) setCategoryId(cur.entry.categoryId);
    if (cur.entry) setDescription(cur.entry.description);
  }

  useEffect(() => {
    if (!props.enabled) return;
    void refresh().catch((err) =>
      setError(err instanceof ApiError ? err.message : t("common.loadFailed")),
    );
  }, [props.enabled]);

  /** 条目切换查看的日期后重新拉取当前视图的数据；回今天（null）时清除持久化。Step 3 DateNav 接入。 */
  function onDateChange(next: string | null) {
    setDate(next);
    saveDateView(next);
    setError("");
    if (view === "day") {
      void api
        .todayEntries(tz, next ?? undefined)
        .then(setToday)
        .catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
    } else {
      void api
        .weekEntries(tz, next ?? undefined)
        .then(setWeek)
        .catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
    }
  }

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
  const weekTotal =
    week?.days.reduce((s, d) => s + d.totalClippedSeconds, 0) ?? 0;

  async function onToggle() {
    setError("");
    try {
      if (running) {
        await api.stop();
        props.onCurrent(null);
      } else {
        if (!categoryId) return;
        const { entry } = await api.start(categoryId, description, tagIds);
        props.onCurrent(entry);
      }
      const entries = await api.todayEntries(tz, date ?? undefined);
      setToday(entries);
      // 已加载过周数据则一并刷新，避免切回周视图时看到过期数据
      if (week) {
        const w = await api.weekEntries(tz, date ?? undefined);
        setWeek(w);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.operationFailed"));
    }
  }

  async function onModeChange(mode: "day" | "week") {
    setView(mode);
    // 切换视图时始终按当前 date 重新拉取目标视图数据：另一视图的数据可能是
    // 在其他日期下拉取的（如先看本周再导航到上周），直接复用会展示错位的周/日
    try {
      if (mode === "week") {
        setWeek(await api.weekEntries(tz, date ?? undefined));
      } else {
        setToday(await api.todayEntries(tz, date ?? undefined));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.loadFailed"));
    }
  }

  /** 条目编辑保存后刷新 today/week；不重置开始计时表单（categoryId/description/tagIds）。 */
  async function refreshEntries() {
    try {
      const [entries, w] = await Promise.all([
        api.todayEntries(tz, date ?? undefined),
        week ? api.weekEntries(tz, date ?? undefined) : Promise.resolve(null),
      ]);
      setToday(entries);
      if (w) setWeek(w);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.loadFailed"));
    }
  }

  const pickerLabel = running?.categoryName ?? selected?.name ?? t("timer.selectCategory");
  const pickerColor = running?.categoryName ?? selected?.name ?? "";
  const tagPickerLabel =
    tagIds.length > 0
      ? tagIds
          .map((id) => tags.find((x) => x.id === id)?.name)
          .filter(Boolean)
          .join(t("timer.tagSeparator"))
      : t("timer.selectTags");

  const barProps = {
    description: running ? running.description : description,
    descriptionReadOnly: Boolean(running),
    onDescriptionChange: setDescription,
    categoryPicker: (
      <CategoryPicker
        categories={categories}
        value={categoryId}
        label={pickerLabel}
        colorName={pickerColor}
        disabled={Boolean(running)}
        onChange={setCategoryId}
      />
    ),
    tagPicker: (
      <TagPicker
        tags={tags}
        value={tagIds}
        label={tagPickerLabel}
        disabled={Boolean(running)}
        onChange={setTagIds}
      />
    ),
    runningTags: running?.tags ?? [],
    elapsed,
    running: Boolean(running),
    canStart: Boolean(categoryId),
    onToggle: () => {
      void onToggle();
    },
    error,
  };

  const timelineProps = {
    today,
    week,
    mode: view,
    onModeChange: (m: "day" | "week") => {
      void onModeChange(m);
    },
    date,
    onDateChange,
    nowMs: props.nowMs,
    tz,
    dayTotal,
    weekTotal,
    categories,
    tags,
    onEntryUpdated: () => {
      void refreshEntries();
    },
  };

  return { barProps, timelineProps };
}