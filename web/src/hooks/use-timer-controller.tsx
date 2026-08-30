import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  api,
  type BoundaryEntries,
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
  // 当前视图窗口的紧邻外侧条目（gap 插槽边界）；null = 未加载/加载失败，静默降级
  const [boundary, setBoundary] = useState<BoundaryEntries | null>(null);
  const [view, setView] = useState<"day" | "week">("day");
  // "YYYY-MM-DD" | null；null = 今天（默认）。查看的日期，day/week 视图共用
  const [date, setDate] = useState<string | null>(loadDateView);
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  // 计时中说明输入框的受控草稿（不直接改 running 对象）；running 切换时重置
  const [runningDraft, setRunningDraft] = useState<string | null>(null);
  // 说明防抖：待发送的 setTimeout id
  const descriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 拉取窗口紧邻外侧条目（gap 插槽边界）；失败静默降级为 null，不阻塞主数据 */
  function loadBoundary(start: string, end: string) {
    return api
      .boundaryEntries(tz, start, end)
      .then(setBoundary)
      .catch(() => setBoundary(null));
  }

  async function refresh() {
    // 先拿 day 视图窗口，与主数据并行拉取 boundary
    const dayWindowP = api.todayEntries(tz, date ?? undefined);
    const boundaryP = dayWindowP.then(
      (d) => api.boundaryEntries(tz, d.dayStart, d.dayEnd).catch(() => null),
      () => undefined as BoundaryEntries | null | undefined,
    );
    const [cats, tagRes, cur, dayWindow, b] = await Promise.all([
      api.categories(),
      api.tags(),
      api.current(),
      dayWindowP,
      boundaryP,
    ]);
    setCategories(cats.categories);
    setTags(tagRes.tags);
    setToday(dayWindow);
    setBoundary(b ?? null);
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
        .then((d) => {
          setToday(d);
          return loadBoundary(d.dayStart, d.dayEnd);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
    } else {
      void api
        .weekEntries(tz, next ?? undefined)
        .then((w) => {
          setWeek(w);
          return loadBoundary(w.weekStart, w.weekEnd);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
    }
  }

  const selected = categories.find((c) => c.id === categoryId);
  const running = props.current;

  // running 切换（开始新计时/停止）时重置说明草稿并取消 pending 防抖，
  // 避免停止后把草稿误发到 timer 接口（409）或残留到新计时表单
  useEffect(() => {
    setRunningDraft(running ? running.description : null);
    if (descriptionDebounceRef.current) {
      clearTimeout(descriptionDebounceRef.current);
      descriptionDebounceRef.current = null;
    }
  }, [running?.id]);

  // 卸载时取消 pending 防抖
  useEffect(
    () => () => {
      if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    },
    [],
  );

  /** 计时中编辑说明：更新草稿，防抖 600ms 后保存 */
  function onRunningDescriptionChange(value: string) {
    setRunningDraft(value);
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    if (!running) return;
    descriptionDebounceRef.current = setTimeout(() => {
      descriptionDebounceRef.current = null;
      api
        .updateCurrent({ description: value })
        .then(({ entry }) => props.onCurrent(entry))
        .catch((err) =>
          setError(err instanceof ApiError ? err.message : t("common.operationFailed")),
        );
    }, 600);
  }

  /** 计时中切换分类：立即保存并刷新 today/week（Timeline 色块颜色） */
  async function onRunningCategoryChange(nextCategoryId: string) {
    if (!running || running.categoryId === nextCategoryId) return;
    try {
      const { entry } = await api.updateCurrent({ categoryId: nextCategoryId });
      props.onCurrent(entry);
      await refreshEntries();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.operationFailed"));
    }
  }

  /** 计时中切换标签：立即保存（标签只影响胶囊展示，不刷 Timeline） */
  async function onRunningTagsChange(nextTagIds: string[]) {
    if (!running) return;
    try {
      const { entry } = await api.updateCurrent({ tagIds: nextTagIds });
      props.onCurrent(entry);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.operationFailed"));
    }
  }

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
      // 已加载过周数据则一并刷新，避免切回周视图时看到过期数据；boundary 随当前视图窗口重拉
      if (week && view === "week") {
        const w = await api.weekEntries(tz, date ?? undefined);
        setWeek(w);
        await loadBoundary(w.weekStart, w.weekEnd);
      } else {
        await loadBoundary(entries.dayStart, entries.dayEnd);
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
        const w = await api.weekEntries(tz, date ?? undefined);
        setWeek(w);
        // 先拿到新视图数据再取其窗口拉 boundary
        await loadBoundary(w.weekStart, w.weekEnd);
      } else {
        const d = await api.todayEntries(tz, date ?? undefined);
        setToday(d);
        await loadBoundary(d.dayStart, d.dayEnd);
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
      // 当前视图窗口重拉 boundary（新建条目可能占用/缩小 gap）
      if (view === "day") {
        await loadBoundary(entries.dayStart, entries.dayEnd);
      } else if (w) {
        await loadBoundary(w.weekStart, w.weekEnd);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.loadFailed"));
    }
  }

  const pickerLabel = running?.categoryName ?? selected?.name ?? t("timer.selectCategory");
  const pickerColor = running?.categoryName ?? selected?.name ?? "";
  const runningTagIds = running?.tags.map((tag) => tag.id) ?? [];
  const tagPickerLabel =
    (running ? runningTagIds : tagIds).length > 0
      ? (running ? runningTagIds : tagIds)
          .map((id) => tags.find((x) => x.id === id)?.name)
          .filter(Boolean)
          .join(t("timer.tagSeparator"))
      : t("timer.selectTags");

  const barProps = {
    description: running ? (runningDraft ?? running.description) : description,
    onDescriptionChange: running ? onRunningDescriptionChange : setDescription,
    categoryPicker: (
      <CategoryPicker
        categories={categories}
        value={running ? running.categoryId : categoryId}
        label={pickerLabel}
        colorName={pickerColor}
        onChange={running ? (id: string) => {
          void onRunningCategoryChange(id);
        } : setCategoryId}
      />
    ),
    tagPicker: (
      <TagPicker
        tags={tags}
        value={running ? runningTagIds : tagIds}
        label={tagPickerLabel}
        onChange={running ? (ids: string[]) => {
          void onRunningTagsChange(ids);
        } : setTagIds}
      />
    ),
    runningTags: running?.tags ?? [],
    runningTagColors: (id: string) => tags.find((x) => x.id === id)?.color ?? null,
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
    boundary,
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