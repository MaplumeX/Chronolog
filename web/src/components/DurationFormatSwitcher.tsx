import { useTranslation } from "react-i18next";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DURATION_FORMATS,
  setDurationFormat,
  useDurationFormat,
  type DurationFormat,
} from "@/duration-format";

const OPTIONS: { value: DurationFormat; labelKey: "durationFormat.letters" | "durationFormat.chinese" }[] = [
  { value: "letters", labelKey: "durationFormat.letters" },
  { value: "chinese", labelKey: "durationFormat.chinese" },
];

/** 时长显示格式切换器：格式偏好为前端本地偏好（localStorage），即选即生效。 */
export function DurationFormatSwitcher() {
  const { t } = useTranslation();
  const current = useDurationFormat();
  const currentOption = OPTIONS.find((o) => o.value === current) ?? OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <Clock className="size-4" />
          <span className="truncate">{t(currentOption.labelKey)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {DURATION_FORMATS.map((value) => {
          const option = OPTIONS.find((o) => o.value === value)!;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setDurationFormat(value)}
              className={current === value ? "bg-accent" : undefined}
            >
              <span>{t(option.labelKey)}</span>
              {current === value ? <Check className="ml-auto" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
