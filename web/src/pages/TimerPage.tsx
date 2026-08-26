import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Category, type Tag, type TimeEntry, type TodayEntries } from "../api";
import { CategoryPicker } from "../components/CategoryPicker";
import { TagPicker } from "../components/TagPicker";
import { Timeline } from "../components/Timeline";
import { TimerBar } from "../components/TimerBar";
import { browserTz, clipSeconds, elapsedSeconds } from "../format";

export function TimerPage(props: {
  nowMs: number;
  current: TimeEntry | null;
  onCurrent: (entry: TimeEntry | null) => void;
}) {
  const { t } = useTranslation();
  const tz = browserTz();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [today, setToday] = useState<TodayEntries | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [cats, tagRes, entries, cur] = await Promise.all([
      api.categories(),
      api.tags(),
      api.todayEntries(tz),
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
    void refresh().catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
  }, []);

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
      const entries = await api.todayEntries(tz);
      setToday(entries);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.operationFailed"));
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

  return (
    <>
      <TimerBar
        description={running ? running.description : description}
        descriptionReadOnly={Boolean(running)}
        onDescriptionChange={setDescription}
        categoryPicker={
          <CategoryPicker
            categories={categories}
            value={categoryId}
            label={pickerLabel}
            colorName={pickerColor}
            disabled={Boolean(running)}
            onChange={setCategoryId}
          />
        }
        tagPicker={
          <TagPicker
            tags={tags}
            value={tagIds}
            label={tagPickerLabel}
            disabled={Boolean(running)}
            onChange={setTagIds}
          />
        }
        runningTags={running?.tags ?? []}
        elapsed={elapsed}
        running={Boolean(running)}
        canStart={Boolean(categoryId)}
        onToggle={() => {
          void onToggle();
        }}
        error={error}
      />
      <Timeline today={today} nowMs={props.nowMs} tz={tz} dayTotal={dayTotal} />
    </>
  );
}
