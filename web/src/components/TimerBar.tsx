import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import { formatDuration } from "../format";
import { Button } from "@/components/ui/button";

/**
 * 桌面顶栏计时条（Shell header 插槽）。双行布局（任务 09-10-chip-pickers）：
 * 行 1 = 描述输入 + 已计时 + 圆形开始/停止；行 2 = 分类胶囊组 + 标签胶囊组。
 * 纯展示组件（无 api import）；胶囊组以 ReactNode 插槽形式由 useTimerController 传入。
 * 计时进行中胶囊带常驻可编辑（D6），不再有只读标签徽章分支。
 * 移动端不渲染本组件（Shell 移动分支改渲染 MobileTimerDock）。
 */
export function TimerBar(props: {
  description: string;
  onDescriptionChange: (value: string) => void;
  categoryPicker: ReactNode;
  tagPicker: ReactNode;
  elapsed: number;
  running: boolean;
  canStart: boolean;
  onToggle: () => void;
  error: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 flex-1 px-4 py-2">
      <div className="flex items-center gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-lg tracking-tight outline-none placeholder:text-muted-foreground"
          placeholder={t("timer.placeholder")}
          value={props.description}
          onChange={(e) => props.onDescriptionChange(e.target.value)}
        />
        <div className="min-w-[88px] shrink-0 text-right font-mono text-xl tabular-nums">
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
      {/* 行 2：胶囊带（分类在左、标签在右，hairline 分隔）；两组各自 flex-wrap 折行，
          外层也 wrap 保证极端宽度下两组可上下堆叠 */}
      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-2">
        {props.categoryPicker}
        <div className="h-5 w-px shrink-0 self-center bg-border" aria-hidden="true" />
        {props.tagPicker}
      </div>
      {props.error ? <p className="mt-2 text-sm text-destructive">{props.error}</p> : null}
    </div>
  );
}
