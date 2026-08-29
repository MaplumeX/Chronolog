import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { enUS, zhCN } from "react-day-picker/locale";

import { localeFor } from "../i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** value 契约："YYYY-MM-DDTHH:mm:ss" 本地时间字符串。 */
const VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

const HOURS_MAX = 23;
const MIN_SEC_MAX = 59;

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

/** 环绕 clamp：负数/越界都在 0–max 内取模。 */
function clampWrap(v: number, max: number): number {
  return ((v % (max + 1)) + (max + 1)) % (max + 1);
}

/**
 * 时/分/秒单段步进输入：直接键入数字（满 2 位自动跳下一段，越界 clamp）、
 * ArrowUp/Down ±1（Shift ±10，环绕）、Backspace 清空当前段、
 * ArrowLeft/Right 在段首/段尾时跨段移动。失焦时未完成的输入规范化。
 */
function TimeField(props: {
  value: number;
  max: number;
  ariaLabel: string;
  onInput: (v: number) => void;
  onFocus: () => void;
  onAdvance: () => void;
  onRetreat: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? props.value.toString().padStart(2, "0");

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      // 先提交未完成的键入，步进基于用户看到的值
      const base = draft !== null && draft !== "" ? Number(draft) : props.value;
      setDraft(null);
      const step = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1);
      props.onInput(clampWrap(base + step, props.max));
      return;
    }
    if (
      e.key === "ArrowLeft" &&
      el.selectionStart === 0 &&
      el.selectionEnd === 0
    ) {
      e.preventDefault();
      props.onRetreat();
      return;
    }
    if (
      e.key === "ArrowRight" &&
      el.selectionStart === el.value.length &&
      el.selectionEnd === el.value.length
    ) {
      e.preventDefault();
      props.onAdvance();
      return;
    }
    if (
      e.key === "Backspace" &&
      el.selectionStart === 0 &&
      el.selectionEnd === 0
    ) {
      e.preventDefault();
      setDraft("");
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 只保留数字；第 3 位出现时视为滚动替换（末 2 位成为新值）
    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
    if (digits.length >= 3) {
      setDraft(null);
      props.onInput(Math.min(Number(digits.slice(1)), props.max));
      return;
    }
    if (digits.length === 2) {
      setDraft(null);
      props.onInput(Math.min(Number(digits), props.max));
      props.onAdvance();
      return;
    }
    setDraft(digits);
  }

  function onBlur() {
    if (draft === null) return;
    if (draft === "") {
      // Backspace 清空后失焦：回落到受控值，维持 value 始终合法的契约
      setDraft(null);
      return;
    }
    props.onInput(Math.min(Number(draft), props.max));
    setDraft(null);
  }

  const inputProps: InputHTMLAttributes<HTMLInputElement> = {
    inputMode: "numeric",
    className:
      "w-8 rounded-sm border-0 bg-transparent p-0 text-center font-mono tabular-nums text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "aria-label": props.ariaLabel,
    value: text,
    onFocus: (e) => {
      // 选中整段：Tab 进入后直接键入即替换，而非在末尾追加（滚动替换）
      e.currentTarget.select();
      props.onFocus();
    },
    onKeyDown,
    onChange,
    onBlur,
  };

  return <input {...inputProps} ref={props.inputRef} />;
}

export function DateTimePicker(props: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** 弹层内时/分/秒段的 aria-label（复用外部 Label 的 i18n 键）。 */
  ariaLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const { value, onChange } = props;
  const date = parseValue(value);
  const fieldRefs = useRef<Array<HTMLInputElement | null>>([null, null, null]);
  const [focusIndex, setFocusIndex] = useState(0);
  // 月份导航本地可控；value 的日期部分变化时（选日/现在按钮）跟随同步
  const [month, setMonth] = useState(date);
  const dateKey = toValue(date).slice(0, 10);
  useEffect(() => {
    setMonth(date);
  }, [dateKey]);

  function setPart(part: "h" | "m" | "s", v: number) {
    const d = new Date(date);
    if (part === "h") d.setHours(v);
    else if (part === "m") d.setMinutes(v);
    else d.setSeconds(v);
    onChange(toValue(d));
  }

  function shiftFocus(delta: number) {
    const next = Math.min(2, Math.max(0, focusIndex + delta));
    const el = fieldRefs.current[next];
    if (el) {
      el.focus();
      el.select();
    }
  }

  const fields: Array<{ part: "h" | "m" | "s"; value: number; max: number }> = [
    { part: "h", value: date.getHours(), max: HOURS_MAX },
    { part: "m", value: date.getMinutes(), max: MIN_SEC_MAX },
    { part: "s", value: date.getSeconds(), max: MIN_SEC_MAX },
  ];

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
          <div className="flex items-center justify-center gap-1 text-sm">
            {fields.map((f, i) => (
              <span key={f.part} className="flex items-center gap-1">
                {i > 0 ? (
                  <span className="font-mono tabular-nums text-muted-foreground">
                    :
                  </span>
                ) : null}
                <TimeField
                  value={f.value}
                  max={f.max}
                  ariaLabel={props.ariaLabel ?? ""}
                  onInput={(v) => setPart(f.part, v)}
                  onFocus={() => setFocusIndex(i)}
                  onAdvance={() => shiftFocus(1)}
                  onRetreat={() => shiftFocus(-1)}
                  inputRef={(el) => {
                    fieldRefs.current[i] = el;
                  }}
                />
              </span>
            ))}
          </div>
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
