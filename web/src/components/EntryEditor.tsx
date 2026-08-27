import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Category, type Tag, type TimeEntry } from "../api";
import { CategoryPicker } from "./CategoryPicker";
import { TagPicker } from "./TagPicker";
import { formatDuration } from "../format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** ISO-Z → 浏览器本地时区的 datetime-local 值（保留秒）。 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function EntryEditor(props: {
  /** 编辑模式：已有条目 */
  entry?: TimeEntry;
  /** 新建模式：拖拽创建的草稿起止时间 */
  draft?: { startedAt: string; stoppedAt: string };
  categories: Category[];
  tags: Tag[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(props.entry?.description ?? "");
  const [categoryId, setCategoryId] = useState(props.entry?.categoryId ?? "");
  const [tagIds, setTagIds] = useState(props.entry?.tags.map((x) => x.id) ?? []);
  const [startedAt, setStartedAt] = useState(
    toLocalInput(props.entry?.startedAt ?? props.draft!.startedAt),
  );
  const [stoppedAt, setStoppedAt] = useState(
    toLocalInput(props.entry?.stoppedAt ?? props.draft!.stoppedAt),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isDraft = props.draft != null;
  const startMs = Date.parse(startedAt);
  const stopMs = Date.parse(stoppedAt);
  const duration = Number.isNaN(startMs) || Number.isNaN(stopMs)
    ? 0
    : Math.max(0, Math.floor((stopMs - startMs) / 1000));
  const selectedCategory = props.categories.find((c) => c.id === categoryId);
  const tagPickerLabel =
    tagIds.length > 0
      ? tagIds
          .map((id) => props.tags.find((x) => x.id === id)?.name)
          .filter(Boolean)
          .join(t("timer.tagSeparator"))
      : t("timer.selectTags");

  async function onSave() {
    if (Number.isNaN(startMs) || Number.isNaN(stopMs)) {
      setError(t("entry.invalidTime"));
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      description,
      categoryId,
      tagIds,
      startedAt: new Date(startMs).toISOString(),
      stoppedAt: new Date(stopMs).toISOString(),
    };
    try {
      if (isDraft) {
        await api.createEntry(body);
      } else {
        await api.updateEntry(props.entry!.id, body);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "OVERLAP") {
        setError(t("entry.overlap"));
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("entry.saveFailed"));
      }
      setSaving(false);
      return;
    }
    props.onSaved();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{isDraft ? t("entry.create") : t("entry.edit")}</h3>
      <div className="space-y-1.5">
        <Label htmlFor="entry-description">{t("entry.description")}</Label>
        <Input
          id="entry-description"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("entry.category")}</Label>
        <CategoryPicker
          categories={props.categories}
          value={categoryId}
          label={selectedCategory?.name ?? t("timer.selectCategory")}
          colorName={selectedCategory?.name ?? ""}
          onChange={setCategoryId}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("entry.tags")}</Label>
        <TagPicker
          tags={props.tags}
          value={tagIds}
          label={tagPickerLabel}
          onChange={setTagIds}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-start">{t("entry.startTime")}</Label>
        <Input
          id="entry-start"
          type="datetime-local"
          step={1}
          value={startedAt}
          onChange={(e) => setStartedAt(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="entry-end">{t("entry.endTime")}</Label>
        <Input
          id="entry-end"
          type="datetime-local"
          step={1}
          value={stoppedAt}
          onChange={(e) => setStoppedAt(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("entry.duration")}</span>
        <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={props.onClose} disabled={saving}>
          {t("entry.cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || (isDraft && categoryId === "")}
        >
          {t("entry.save")}
        </Button>
      </div>
    </div>
  );
}
