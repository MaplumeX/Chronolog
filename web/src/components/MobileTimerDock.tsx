import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import { formatDuration, paletteColor } from "../format";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * 移动端（<768px）Timer 页底部停靠胶囊：固定在 MobileTabBar 正上方，
 * 常驻显示描述摘要 + 分类色点 + 已计时时长 + 开始/停止按钮（数据全部来自
 * useTimerController 的 barProps，零业务逻辑）。点胶囊非按钮区域展开
 * bottom sheet（#51 规格）编辑描述/分类/标签；关闭 sheet 不影响计时状态。
 * 桌面端不渲染本组件（Shell 移动端分支独占）。
 */
export function MobileTimerDock(props: {
  description: string;
  onDescriptionChange: (value: string) => void;
  categoryPicker: ReactNode;
  tagPicker: ReactNode;
  runningTags: { id: string; name: string }[];
  /** 运行中标签的显式色（按 tagId 查自标签列表），未设定回退 hash 色 */
  runningTagColors: (id: string) => number | null;
  /** 胶囊摘要行的分类色（running ?? selected），null = 未选分类 */
  categoryColor: string | null;
  /** 无间隙换段后的引导信号（useTimerController 的 categoryPickerAutoOpen）：true 时自动展开编辑 sheet */
  autoOpenEditor?: boolean;
  /** sheet 被用户关闭（未选分类）时复位 autoOpenEditor 信号 */
  onAutoOpenConsumed?: () => void;
  elapsed: number;
  running: boolean;
  canStart: boolean;
  onToggle: () => void;
  error: string;
}) {
  const { t } = useTranslation();
  // 手动打开状态（点胶囊摘要区）；sheet 的 open 是派生值：
  // manualOpen || autoOpenEditor —— 无间隙换段后 autoOpenEditor=true 直接展开 sheet
  // （内部 CategoryPicker 受控 open 接着自动弹下拉），选完分类信号复位 → sheet 派生关闭
  const [manualOpen, setManualOpen] = useState(false);
  const sheetOpen = manualOpen || props.autoOpenEditor === true;

  return (
    <Sheet
      open={sheetOpen}
      onOpenChange={(open) => {
        setManualOpen(open);
        // 用户未选分类直接关 sheet（Esc/遮罩/drag-handle）：复位引导信号，不残留
        if (!open && props.autoOpenEditor === true) {
          props.onAutoOpenConsumed?.();
        }
      }}
    >
      {/* 停靠胶囊：Tab 栏正上方的常驻条；摘要区域为 SheetTrigger（打开编辑 sheet），
          开始/停止按钮是兄弟节点而非嵌套（button 不能嵌套 button） */}
      <div className="fixed inset-x-0 bottom-[calc(var(--mobile-tabbar-h)+env(safe-area-inset-bottom))] z-40 flex min-h-14 items-center gap-3 border-t bg-card px-4 text-card-foreground md:hidden">
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={t("timer.dockAria")}
            aria-haspopup="dialog"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            {props.categoryColor ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: props.categoryColor }}
                aria-hidden="true"
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-sm">
              {props.description || t("timer.placeholder")}
            </span>
            <span className="shrink-0 font-mono text-base tabular-nums">
              {formatDuration(props.elapsed)}
            </span>
          </button>
        </SheetTrigger>
        <Button
          type="button"
          size="icon"
          variant={props.running ? "destructive" : "default"}
          className="size-11 shrink-0 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle();
          }}
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
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-h-[85dvh] gap-0 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("timer.dockSheetTitle")}</SheetTitle>
        </SheetHeader>
        <div
          aria-hidden="true"
          className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            <input
              className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              placeholder={t("timer.placeholder")}
              value={props.description}
              onChange={(e) => props.onDescriptionChange(e.target.value)}
            />
            {props.categoryPicker}
            {props.running && props.runningTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {props.runningTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                    title={tag.name}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        background: paletteColor(
                          props.runningTagColors(tag.id),
                          tag.name,
                        ),
                      }}
                      aria-hidden="true"
                    />
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : (
              props.tagPicker
            )}
            {props.error ? (
              <p className="text-sm text-destructive">{props.error}</p>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
