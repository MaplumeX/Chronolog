import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { enUS, zhCN } from "react-day-picker/locale";

import { localeFor } from "../i18n";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** "YYYY-MM-DD" → UTC 午夜 Date，仅用于纯日历运算/格式化（不涉及时区换算）。 */
function toDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 纯日历日期加减（"YYYY-MM-DD" 本身就是日历标签，无时区偏移问题）。 */
function shiftDate(date: string, days: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDate(d);
}

/** 归一化到所在 ISO 周的周一（week 视图锚点，与后端 weekBounds 的周一对齐）。 */
function toWeekStart(date: string): string {
  const d = toDate(date);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return fromDate(d);
}

/** tz 当地的今天（Intl 格式化，安全跨时区）。 */
function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Date（本地午夜，来自 Calendar）→ "YYYY-MM-DD"。 */
function fromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → 本地午夜 Date（tz 即浏览器时区，供 Calendar 使用）。 */
function toLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DateNav(props: {
  view: "day" | "week";
  date: string | null;
  tz: string;
  onChange: (date: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const { view, date, tz, onChange } = props;
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isWeek = view === "week";
  const today = todayIn(tz);
  const current = date ?? today;
  // week 视图始终以周一为锚点（与后端 ISO 周对齐）
  const anchored = isWeek ? toWeekStart(current) : current;
  const step = isWeek ? 7 : 1;

  const locale = localeFor(i18n.language);
  const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
    toDate(date).toLocaleDateString(locale, { timeZone: "UTC", ...opts });

  const label =
    date === null
      ? isWeek
        ? t("timeline.thisWeek")
        : t("timeline.today")
      : isWeek
        ? `${fmt(anchored, { month: "long", day: "numeric" })} – ${fmt(shiftDate(anchored, 6), { month: "long", day: "numeric" })}`
        : fmt(anchored, { month: "long", day: "numeric", weekday: "short" });

  function navigate(days: number) {
    const next = shiftDate(anchored, days);
    onChange(isWeek ? toWeekStart(next) : next);
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("timeline.prev")}
        onClick={() => navigate(-step)}
      >
        <ChevronLeft />
      </Button>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="font-semibold">
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date ? toLocalDate(current) : undefined}
            defaultMonth={toLocalDate(anchored)}
            locale={i18n.language === "zh" ? zhCN : enUS}
            onSelect={(day) => {
              if (!day) return;
              // 选中今天本身时归一化回 null（隐藏"回到今天"按钮，与动态标签语义一致）
              setCalendarOpen(false);
              const picked = fromLocalDate(day);
              const normalized = picked === today ? null : picked;
              onChange(isWeek ? (normalized ? toWeekStart(normalized) : null) : normalized);
            }}
          />
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("timeline.next")}
        onClick={() => navigate(step)}
      >
        <ChevronRight />
      </Button>
      {date !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => onChange(null)}
        >
          {t("timeline.backToToday")}
        </Button>
      ) : null}
    </div>
  );
}