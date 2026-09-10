import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { enUS, zhCN } from "react-day-picker/locale";

import { localeFor } from "../i18n";
import { formatDuration } from "../format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** value 契约："YYYY-MM-DDTHH:mm:ss" 本地时间字符串（与 EntryEditor 一致）。 */
const VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 解析 value；失败时回落到当前本地时刻（EntryEditor 侧 Date.parse 的 NaN 分支仍兜底）。 */
function parseValue(value: string): Date {
  const m = VALUE_RE.exec(value);
  if (!m) return new Date();
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * 时长输入解析（纯函数，秒）：
 * - `H:MM:SS` / `H:MM`（冒号式，分钟/秒补零可选）
 * - `90m` / `1.5h` / `45s`（单位式，支持小数）；无单位纯数字按分钟（Toggl 惯例，`0` 即零时长）
 * 无法解析（含空串/乱串/负数）返回 null；0 合法（瞬时条目）。
 */
export function parseDurationInput(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (t === "") return null;
  let m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(t);
  if (m) {
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0);
  }
  m = /^(\d+(?:\.\d+)?)\s*(h|m|s)?$/.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (m[2] === "h") return n * 3600;
    if (m[2] === "s") return n;
    return n * 60;
  }
  return null;
}

/* ---------- 内部子组件 ---------- */

/** 原生 time input（step=1），value 即 "HH:mm:ss"；空值（清空）不提交。 */
function TimeField(props: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <Input
      id={props.id}
      type="time"
      step={1}
      value={props.value.slice(11)}
      aria-label={props["aria-label"]}
      className="h-9 font-mono tabular-nums [color-scheme:light] dark:[color-scheme:dark]"
      onChange={(e) => {
        if (e.target.value === "") return;
        props.onChange(`${props.value.slice(0, 10)}T${e.target.value}`);
      }}
    />
  );
}

/** 紧凑行里的一个可点击槽位：label 小字 + mono 值 + 可选跨天日期副行。 */
function SlotButton(props: {
  label: string;
  value: string;
  date?: string | null;
  active: boolean;
  ariaLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      aria-expanded={props.active}
      onClick={props.onOpen}
      className={`flex-1 min-w-0 cursor-pointer rounded-md px-2 py-1 text-left transition-colors ${
        props.active ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="truncate font-mono text-sm tabular-nums">{props.value}</div>
      {props.date ? (
        <div className="truncate text-[10px] text-muted-foreground">{props.date}</div>
      ) : null}
    </button>
  );
}

/** 日期调整（Calendar popover）：点选后替换日期、保留时间，随后关闭 popover。 */
function DateAdjust(props: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const date = parseValue(props.value);
  // 月份导航本地可控；value 的日期部分变化时（选日/时间改动跨天）跟随同步
  const [month, setMonth] = useState(date);
  const dateKey = props.value.slice(0, 10);
  useEffect(() => {
    setMonth(date);
  }, [dateKey]); // date 仅随 dateKey 变化，避免每渲染重置

  const { i18n } = useTranslation();
  const locale = localeFor(i18n.language);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 font-normal"
        >
          <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{props.label}</span>
          <span className="ml-auto truncate">
            {date.toLocaleDateString(locale, {
              month: "numeric",
              day: "numeric",
              weekday: "short",
            })}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          month={month}
          onMonthChange={setMonth}
          locale={i18n.language === "zh" ? zhCN : enUS}
          onSelect={(day) => {
            if (!day) return;
            const d = new Date(day);
            d.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
            props.onChange(toValue(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ---------- 主组件 ---------- */

export function EntryTimeRangeEditor(props: {
  startedAt: string;
  stoppedAt: string;
  onStartChange: (v: string) => void;
  onStopChange: (v: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState<"none" | "start" | "end" | "duration">("none");

  const sameDay =
    props.startedAt.slice(0, 10) === props.stoppedAt.slice(0, 10);
  const duration = Number.isNaN(Date.parse(props.startedAt)) ||
      Number.isNaN(Date.parse(props.stoppedAt))
    ? 0
    : Math.max(0, Math.floor((Date.parse(props.stoppedAt) - Date.parse(props.startedAt)) / 1000));

  const locale = localeFor(i18n.language);
  const dateLabel = (v: string) =>
    new Date(v).toLocaleDateString(locale, {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });

  /** 时长提交：以开始时间为锚反推结束时间；溢出/超 Date 范围（如 999999999999m）不落地（R6）。 */
  function applyDuration(sec: number) {
    const s = parseValue(props.startedAt);
    const endMs = s.getTime() + sec * 1000;
    if (!Number.isSafeInteger(endMs) || Number.isNaN(new Date(endMs).getTime())) {
      return;
    }
    props.onStopChange(toValue(new Date(endMs)));
  }

  function toggle(k: "start" | "end" | "duration") {
    setEditing(editing === k ? "none" : k);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-lg border p-1">
        <SlotButton
          label={t("entry.timeRange.start")}
          value={props.startedAt.slice(11)}
          date={sameDay ? null : dateLabel(props.startedAt)}
          active={editing === "start"}
          ariaLabel={t("entry.timeRange.startAria")}
          onOpen={() => toggle("start")}
        />
        <span className="text-muted-foreground">→</span>
        <SlotButton
          label={t("entry.timeRange.end")}
          value={props.stoppedAt.slice(11)}
          date={sameDay ? null : dateLabel(props.stoppedAt)}
          active={editing === "end"}
          ariaLabel={t("entry.timeRange.endAria")}
          onOpen={() => toggle("end")}
        />
        <span className="text-muted-foreground">·</span>
        <SlotButton
          label={t("entry.timeRange.duration")}
          value={formatDuration(duration)}
          active={editing === "duration"}
          ariaLabel={t("entry.timeRange.durationAria")}
          onOpen={() => toggle("duration")}
        />
      </div>

      {editing === "start" || editing === "end" ? (
        <div className="space-y-1.5 rounded-lg border p-2">
          <Label className="text-xs">
            {editing === "start"
              ? t("entry.startTime")
              : t("entry.endTime")}
          </Label>
          <TimeField
            value={editing === "start" ? props.startedAt : props.stoppedAt}
            aria-label={
              editing === "start"
                ? t("entry.startTime")
                : t("entry.endTime")
            }
            onChange={editing === "start" ? props.onStartChange : props.onStopChange}
          />
          <DateAdjust
            value={editing === "start" ? props.startedAt : props.stoppedAt}
            onChange={editing === "start" ? props.onStartChange : props.onStopChange}
            label={
              editing === "start"
                ? t("entry.timeRange.startDate")
                : t("entry.timeRange.endDate")
            }
          />
        </div>
      ) : null}

      {editing === "duration" ? (
        <div className="space-y-1.5 rounded-lg border p-2">
          <Label className="text-xs" htmlFor="entry-duration-input">
            {t("entry.timeRange.duration")}
          </Label>
          <Input
            id="entry-duration-input"
            className="h-9 font-mono tabular-nums"
            placeholder={t("entry.timeRange.durationPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const parsed = parseDurationInput(e.currentTarget.value);
                if (parsed != null) applyDuration(parsed);
                // 非法输入不落地（R6）：保留原值可重输，不提交、不报错
              }
            }}
          />
          <div className="flex flex-wrap gap-1">
            {[15, 30, 60, 90].map((m) => (
              <Button
                key={m}
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => applyDuration(m * 60)}
              >
                {m}m
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => props.onStopChange(toValue(new Date()))}
            >
              {t("entry.timeRange.untilNow")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
