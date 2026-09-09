import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { ApiError, api, type Category, type Tag, type TimeEntry } from "../api";
import { CategoryPicker } from "./CategoryPicker";
import { EntryTimeRangeEditor } from "./EntryTimeRangeEditor";
import { MergeDialog } from "./MergeDialog";
import { TagPicker } from "./TagPicker";
import { filterActive } from "../hierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "./ConfirmDialog";

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
  /** 相邻候选（合并功能）：全时序前驱/后继，null = 不存在或不可用（运行中） */
  prevEntry?: TimeEntry | null;
  nextEntry?: TimeEntry | null;
  /** 展示时区（相邻合并对话框预览用） */
  tz?: string;
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
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  // 相邻合并：mergeDialog 非空即挂载 MergeDialog（关闭时卸置，重开重置 keep 选择）
  const [mergeDialog, setMergeDialog] = useState<"prev" | "next" | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const isDraft = props.draft != null;
  const startMs = Date.parse(startedAt);
  const stopMs = Date.parse(stoppedAt);
  const selectedCategory = filterActive(props.categories).find(
    (c) => c.id === categoryId,
  );
  // 未选中活动分类时的显示兜底：未分类条目用后端 coalesce 的“未分类”；
  // 指向归档分类的既有条目用后端返回的 categoryName（PRD：编辑时选择器显示当前值），
  // 保存仍要求切换到活动分类（后端换绑归档分类会 409）；未分类条目同样显示“未分类”
  const categoryLabel = selectedCategory?.name ?? (!isDraft ? props.entry!.categoryName : "");
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
    // 硬校验：end ≤ start 拒绝保存（R9）；编辑期间不联动、不自动修改另一端
    if (stopMs <= startMs) {
      setError(t("entry.invalidRange"));
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

  /** 弹窗确认删除：成功后 onSaved()（关 popover + 刷新）；失败关弹窗、错误留在编辑器内可重试 */
  async function onDelete() {
    setDeleting(true);
    setError("");
    try {
      await api.deleteEntry(props.entry!.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("entry.deleteFailed"));
      }
      setDeleting(false);
      setDeleteDialogOpen(false);
      return;
    }
    props.onSaved();
  }

  /** 合并相邻条目：成功后 onSaved()（关 popover + 刷新）；失败错误留在对话框内可重试 */
  async function onMerge(keep: "self" | "other") {
    if (!mergeDialog) return;
    setMerging(true);
    setMergeError("");
    try {
      await api.mergeEntry(props.entry!.id, { direction: mergeDialog, keep });
    } catch (err) {
      setMergeError(
        err instanceof ApiError ? err.message : t("entry.mergeFailed"),
      );
      setMerging(false);
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
          categories={filterActive(props.categories)}
          value={categoryId}
          label={categoryLabel || t("timer.selectCategory")}
          colorName={selectedCategory?.name ?? categoryLabel}
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
        <Label>{t("entry.timeRange.label")}</Label>
        <EntryTimeRangeEditor
          startedAt={startedAt}
          stoppedAt={stoppedAt}
          onStartChange={setStartedAt}
          onStopChange={setStoppedAt}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!isDraft ? (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t("entry.deleteConfirmTitle")}
          description={t("entry.deleteConfirmDescription")}
          confirmText={t("common.confirmDelete")}
          cancelText={t("common.cancel")}
          pending={deleting}
          destructive
          onConfirm={() => void onDelete()}
        />
      ) : null}
      {!isDraft && mergeDialog && (mergeDialog === "prev" ? props.prevEntry : props.nextEntry) ? (
        <MergeDialog
          open
          onOpenChange={(open) => {
            if (!open && !merging) setMergeDialog(null);
          }}
          self={props.entry!}
          other={
            (mergeDialog === "prev" ? props.prevEntry : props.nextEntry)!
          }
          direction={mergeDialog}
          tz={props.tz ?? "UTC"}
          pending={merging}
          error={mergeError}
          onConfirm={(keep) => void onMerge(keep)}
        />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {!isDraft ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={saving || deleting || merging}
          >
            {t("entry.delete")}
          </Button>
        ) : null}
        {!isDraft ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={saving || deleting || merging || props.prevEntry == null}
            title={props.prevEntry ? t("entry.mergePrev") : t("entry.mergeNoPrev")}
            onClick={() => {
              setMergeError("");
              setMergeDialog("prev");
            }}
          >
            <ArrowUpToLine />
            {t("entry.mergePrev")}
          </Button>
        ) : null}
        {!isDraft ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={saving || deleting || merging || props.nextEntry == null}
            title={props.nextEntry ? t("entry.mergeNext") : t("entry.mergeNoNext")}
            onClick={() => {
              setMergeError("");
              setMergeDialog("next");
            }}
          >
            <ArrowDownToLine />
            {t("entry.mergeNext")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={props.onClose}
          disabled={saving || deleting || merging}
        >
          {t("entry.cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || deleting || merging || categoryId === ""}
        >
          {t("entry.save")}
        </Button>
      </div>
    </div>
  );
}
