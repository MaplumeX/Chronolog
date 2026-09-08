import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { TimeEntry } from "../api";
import { formatDuration, formatEntryTimeRange } from "../format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 相邻条目合并确认弹窗（task 09-08-merge-entries）：
 * 两张条目预览卡二选一（keep = self/other，默认当前条目），
 * 展示合并后的时间范围预览。纯展示组件 —— API 调用与刷新由调用方
 * （EntryEditor 的 onConfirm 回调）处理，error 文案由调用方传入。
 * 基于 ui/dialog，fade-only 动画（勿加 zoom，见组件规范）。
 */
export function MergeDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前条目（编辑器所打开的条目） */
  self: TimeEntry;
  /** 相邻条目（合并目标） */
  other: TimeEntry;
  direction: "prev" | "next";
  /** 展示时区（与 Timeline 一致的 App 派生 tz） */
  tz: string;
  /** 确认回调（请求由调用方发起） */
  onConfirm: (keep: "self" | "other") => void;
  /** 请求进行中：禁用按钮 */
  pending: boolean;
  /** 非空时内联展示（destructive 色），可重试 */
  error: string;
}) {
  const { t } = useTranslation();
  const [keep, setKeep] = useState<"self" | "other">("self");
  const { self, other, tz } = props;
  // 候选均为已停止条目（运行中不参与合并），nowMs 仅作占位不参与展示
  const nowMs = 0;

  const start = [self.startedAt, other.startedAt].sort()[0]!;
  // 候选均为已停止条目（运行中不参与合并），取较晚的 stoppedAt
  const stop = [self.stoppedAt ?? "", other.stoppedAt ?? ""].sort(
    (a, b) => b.localeCompare(a),
  )[0]!;
  const card = (entry: TimeEntry, which: "self" | "other") => {
    const label =
      which === "self" ? t("entry.mergeSelf") : t("entry.mergeOther");
    const selected = keep === which;
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => setKeep(which)}
        disabled={props.pending}
        className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
          selected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border hover:bg-accent"
        }`}
      >
        <span
          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
          }`}
        >
          {selected ? <Check className="size-3" /> : null}
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span className="block font-mono text-xs tabular-nums">
            {formatEntryTimeRange(entry.startedAt, entry.stoppedAt, tz, nowMs)}
          </span>
          <span className="block text-sm font-medium">
            {entry.categoryName} · {formatDuration(entry.durationSeconds)}
          </span>
          {entry.tags.length > 0 ? (
            <span className="block text-xs text-muted-foreground">
              {entry.tags.map((x) => x.name).join(t("timer.tagSeparator"))}
            </span>
          ) : null}
          {entry.description ? (
            <span className="block truncate text-xs text-muted-foreground">
              {entry.description}
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("entry.mergeTitle")}</DialogTitle>
          <DialogDescription>{t("entry.mergeKeepLabel")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {/* 按时间顺序排列：prev 时相邻条在前，next 时当前条在前 */}
          {props.direction === "prev"
            ? [card(other, "other"), card(self, "self")]
            : [card(self, "self"), card(other, "other")]}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("entry.mergeResult")}：
          <span className="font-mono tabular-nums">
            {formatEntryTimeRange(start, stop, tz, nowMs)}
          </span>
        </p>
        {props.error ? (
          <p className="text-sm text-destructive">{props.error}</p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={props.pending}
            onClick={() => props.onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={props.pending}
            onClick={() => props.onConfirm(keep)}
          >
            {props.pending ? t("entry.mergePending") : t("entry.mergeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
