import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { enUS, zhCN } from "react-day-picker/locale";

import { localeFor } from "../i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** value 契约："YYYY-MM-DDTHH:mm:ss" 本地时间字符串。 */
const VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function DateTimePicker(props: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** 弹层内时间输入的 aria-label（复用外部 Label 的 i18n 键）。 */
  ariaLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const { value, onChange } = props;
  const date = parseValue(value);
  // 月份导航本地可控；value 的日期部分变化时（选日/现在按钮）跟随同步
  const [month, setMonth] = useState(date);
  const dateKey = toValue(date).slice(0, 10);
  useEffect(() => {
    setMonth(date);
  }, [dateKey]);

  // step={1} 的原生 time input，value 即 "HH:mm:ss"，直接复用契约串的时间部分
  const timeValue = toValue(date).slice(11);

  function onTimeChange(next: string) {
    // 空值（清空）不提交，维持当前值；其余值由浏览器保证 "HH:mm:ss" 合法
    if (next === "") return;
    onChange(`${dateKey}T${next}`);
  }

  const locale = localeFor(i18n.language);
  const dateLabel = date.toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const timeLabel = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={props.id}
          variant="outline"
          disabled={props.disabled}
          className="w-full justify-start gap-2 rounded-lg font-normal"
        >
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {dateLabel}{" "}
            <span className="font-mono tabular-nums">{timeLabel}</span>
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
            onChange(toValue(d));
          }}
        />
        <div className="border-t p-3">
          <Input
            type="time"
            step={1}
            value={timeValue}
            aria-label={props.ariaLabel}
            className="h-9 font-mono tabular-nums [color-scheme:light] dark:[color-scheme:dark]"
            onChange={(e) => onTimeChange(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange(toValue(new Date()))}
            >
              {t("entry.now")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
