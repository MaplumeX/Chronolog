import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import { formatDuration } from "../format";
import { Button } from "@/components/ui/button";

export function TimerBar(props: {
  description: string;
  descriptionReadOnly: boolean;
  onDescriptionChange: (value: string) => void;
  categoryPicker: ReactNode;
  elapsed: number;
  running: boolean;
  canStart: boolean;
  onToggle: () => void;
  error: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-b px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          placeholder={t("timer.placeholder")}
          value={props.description}
          onChange={(e) => {
            if (!props.descriptionReadOnly) props.onDescriptionChange(e.target.value);
          }}
          readOnly={props.descriptionReadOnly}
        />
        {props.categoryPicker}
        <div className="flex items-center justify-end gap-3">
          <div className="min-w-[88px] text-right font-mono text-lg tabular-nums">
            {formatDuration(props.elapsed)}
          </div>
          <Button
            type="button"
            size="icon"
            variant={props.running ? "destructive" : "default"}
            className="size-11 shrink-0 rounded-full"
            onClick={props.onToggle}
            disabled={!props.running && !props.canStart}
            aria-label={props.running ? t("timer.stop") : t("timer.start")}
          >
            {props.running ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
          </Button>
        </div>
      </div>
      {props.error ? <p className="mt-2 text-sm text-destructive">{props.error}</p> : null}
    </div>
  );
}
