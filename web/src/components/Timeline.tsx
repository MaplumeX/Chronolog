import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Category, Tag, TimeEntry, TodayEntries, WeekEntries } from "../api";
import {
  categoryColor,
  clipSeconds,
  contrastText,
  formatClock,
  formatDayLabel,
  formatDuration,
  formatWeekLabel,
  formatWeekdayHeader,
} from "../format";
import { DateNav } from "./DateNav";
import { EntryEditor } from "./EntryEditor";
import { Button } from "./ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Minus, Plus } from "lucide-react";

const SCALES = [60, 30, 15, 5] as const;
type Scale = (typeof SCALES)[number];
const PX_PER_TICK = 40;

/** 档位 → 每档分钟数对应的时间线总高：(1440 / 分钟数) × 40px */
const innerHeightFor = (scale: Scale) => (1440 / scale) * PX_PER_TICK;

/** 第 i 个刻度的标签（HH:MM） */
function tickLabel(i: number, scale: Scale): string {
  const m = i * scale;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function isDayAt(day: TodayEntries, nowMs: number): boolean {
  return nowMs >= Date.parse(day.dayStart) && nowMs < Date.parse(day.dayEnd);
}

/** 档位 → 拖拽创建 snap 网格（分钟）：60→15、30→10、15→5、5→1 */
const SNAP_MINUTES: Record<Scale, number> = { 60: 15, 30: 10, 15: 5, 5: 1 };

/** 拖拽创建预览状态：track 像素坐标内的起止（snap 后，自动排序） */
type DragPreview = { startMs: number; endMs: number };

/** 单日 24h 纵向时间线：ruler + track + blocks + now-line。day 与 week 模式共用。 */
function DayColumn(props: {
  day: TodayEntries | null;
  nowMs: number;
  tz: string;
  isToday: boolean;
  showRuler?: boolean;
  scale: Scale;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDragCreate?: (draft: { startedAt: string; stoppedAt: string }) => void;
  /** 草稿锚点：拖拽结束后固化的预览块，同时作为 popover 的定位 anchor（仅归属列传入） */
  draftAnchor?: { startMs: number; endMs: number } | null;
}) {
  const { t } = useTranslation();
  const { day, nowMs, tz, isToday, showRuler = true, scale, selectedId, onSelect, onDragCreate, draftAnchor } = props;

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragStartMsRef = useRef(0);
  const dragMovedRef = useRef(false);

  const dayStartMs = day ? Date.parse(day.dayStart) : 0;
  const dayEndMs = day ? Date.parse(day.dayEnd) : 0;
  const dayMs = dayEndMs - dayStartMs || 1;
  const tickCount = 1440 / scale;

  const snapMs = (ms: number) => {
    const gridMs = SNAP_MINUTES[scale] * 60_000;
    const snapped = Math.round(ms / gridMs) * gridMs;
    return Math.max(dayStartMs, Math.min(dayEndMs, snapped));
  };

  /** pointer 事件坐标 → snap 后的 day 绝对时间 ms，clamp 到当天窗口 */
  const pointerToMs = (e: React.PointerEvent): number => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return snapMs(dayStartMs + ratio * dayMs);
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!onDragCreate || !day) return;
    if (e.button !== 0) return;
    // 命中色块：走原有点击编辑流程（R7）
    if ((e.target as Element).closest(".timeline-block")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartMsRef.current = pointerToMs(e);
    dragMovedRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!onDragCreate || !day) return;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const ms = pointerToMs(e);
    if (ms !== dragStartMsRef.current) dragMovedRef.current = true;
    if (!dragMovedRef.current) return;
    const startMs = Math.min(dragStartMsRef.current, ms);
    let endMs = Math.max(dragStartMsRef.current, ms);
    if (startMs === endMs) endMs = startMs + SNAP_MINUTES[scale] * 60_000; // 不足一格按一格（R4）
    setDragPreview({ startMs, endMs });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!onDragCreate || !day) return;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // 几乎未移动（点击）不触发创建（AC5）
    if (!dragMovedRef.current) {
      setDragPreview(null);
      return;
    }
    const ms = pointerToMs(e);
    const startMs = Math.min(dragStartMsRef.current, ms);
    let endMs = Math.max(dragStartMsRef.current, ms);
    if (startMs === endMs) endMs = startMs + SNAP_MINUTES[scale] * 60_000; // 不足一格按一格（R4）
    setDragPreview(null);
    onDragCreate({
      startedAt: new Date(startMs).toISOString(),
      stoppedAt: new Date(endMs).toISOString(),
    });
  }

  const posPercent = (t: number) =>
    Math.max(0, Math.min(100, ((t - dayStartMs) / dayMs) * 100));

  const nowTop = posPercent(nowMs);

  return (
    <div className="timeline-inner" style={{ height: `${innerHeightFor(scale)}px` }}>
      {showRuler ? (
        <div className="timeline-ruler">
          {Array.from({ length: tickCount + 1 }, (_, i) => (
            <div key={i} className="hour" style={{ top: `${(i / tickCount) * 100}%` }}>
              {tickLabel(i, scale)}
            </div>
          ))}
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={`timeline-track${showRuler ? "" : " timeline-track--full"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          // 系统中断拖拽（来电/滚动接管等）：capture 自动丢失，清理预览避免残留
          setDragPreview(null);
          dragMovedRef.current = false;
        }}
      >
        {Array.from({ length: tickCount + 1 }, (_, i) => (
          <div key={i} className="timeline-grid" style={{ top: `${(i / tickCount) * 100}%` }} />
        ))}

        {dragPreview ? (
          <div
            className="timeline-block drag-preview"
            style={{
              top: `${((dragPreview.startMs - dayStartMs) / dayMs) * 100}%`,
              height: `${((dragPreview.endMs - dragPreview.startMs) / dayMs) * 100}%`,
            }}
          >
            <span className="block-time">
              {`${formatClock(new Date(dragPreview.startMs).toISOString(), tz)} – ${formatClock(new Date(dragPreview.endMs).toISOString(), tz)}`}
            </span>
          </div>
        ) : null}

        {draftAnchor ? (
          // 拖拽结束后的固化预览块：既是视觉残留也是 popover 的定位 anchor。
          // 无 anchor 时 Radix 会把 popover 定位到屏幕外（translate(0,-200%)），编辑器看起来没打开。
          // 零尺寸 Anchor 钉在预览块中心，使编辑面板从预览块中部向右弹出（空间不足时自动翻转）
          <div
            className="timeline-block drag-preview"
            style={{
              top: `${((draftAnchor.startMs - dayStartMs) / dayMs) * 100}%`,
              height: `${((draftAnchor.endMs - draftAnchor.startMs) / dayMs) * 100}%`,
            }}
          >
            <span className="block-time">
              {`${formatClock(new Date(draftAnchor.startMs).toISOString(), tz)} – ${formatClock(new Date(draftAnchor.endMs).toISOString(), tz)}`}
            </span>
            <PopoverAnchor className="absolute top-1/2 left-1/2 h-0 w-0" />
          </div>
        ) : null}

        {day
          ? day.entries.map((e) => {
              const start = Date.parse(e.startedAt);
              const end = e.stoppedAt ? Date.parse(e.stoppedAt) : nowMs;
              const top = posPercent(start);
              const heightPct = Math.max(
                0,
                Math.min(100 - top, ((end - start) / dayMs) * 100),
              );
              const isRunning = !e.stoppedAt;
              const secs = clipSeconds(
                e.startedAt,
                e.stoppedAt,
                day.dayStart,
                day.dayEnd,
                nowMs,
              );
              const timeRange = `${formatClock(e.startedAt, tz)} – ${
                e.stoppedAt ? formatClock(e.stoppedAt, tz) : "…"
              }`;
              const color = categoryColor(e.categoryName);
              const textColor = contrastText(color);
              const desc = e.description || t("timeline.noDescription");

              // tier 阈值按像素校准（60 档下 2.5% ≈ 24px、1% ≈ 10px），细档位下不因高度放大而失真
              const heightPx = (heightPct / 100) * innerHeightFor(scale);
              let tier: "full" | "compact" | "mini";
              if (heightPx >= 24) tier = "full";
              else if (heightPx >= 10) tier = "compact";
              else tier = "mini";

              const title = `${desc} · ${e.categoryName} · ${timeRange} · ${formatDuration(secs)}${
                e.tags.length > 0 ? ` · ${e.tags.map((x) => x.name).join(t("timer.tagSeparator"))}` : ""
              }`;

              const blockContent = (
                <>
                  {tier === "full" ? (
                    <>
                      <div className="block-desc">{desc}</div>
                      <div className="block-meta">{e.categoryName}</div>
                      {e.tags.length > 0 ? (
                        <div className="block-tags">
                          {e.tags.map((tag) => (
                            <span key={tag.id} className="block-tag">
                              <span
                                className="size-1.5 shrink-0 rounded-full"
                                style={{ background: categoryColor(tag.name) }}
                              />
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="block-time">{timeRange}</div>
                      <div className="block-dur">{formatDuration(secs)}</div>
                    </>
                  ) : tier === "compact" ? (
                    <>
                      <span className="block-desc">{desc}</span>
                      <span className="block-dur">{formatDuration(secs)}</span>
                    </>
                  ) : (
                    <span className="block-desc">{desc}</span>
                  )}
                </>
              );

              const blockStyle = {
                top: `${top}%`,
                height: `${heightPct}%`,
                background: color,
                color: textColor,
              };

              // 选中的已停止条目：色块内嵌一个钉在色块中心的零尺寸 Anchor 作为 popover 定位锚点，
              // 使编辑面板从条目中部向右弹出（空间不足时由 Radix 自动翻转，仍遮住当前条目）
              if (selectedId === e.id) {
                return (
                  <div
                    key={e.id}
                    className={`timeline-block ${tier} cursor-pointer`}
                    style={blockStyle}
                    title={title}
                    onClick={() => onSelect(e.id)}
                  >
                    {blockContent}
                    <PopoverAnchor className="absolute top-1/2 left-1/2 h-0 w-0" />
                  </div>
                );
              }
              return (
                <div
                  key={e.id}
                  className={`timeline-block ${tier}${isRunning ? " running" : " cursor-pointer"}`}
                  style={blockStyle}
                  title={title}
                  onClick={isRunning ? undefined : () => onSelect(e.id)}
                >
                  {blockContent}
                </div>
              );
            })
          : null}

        {isToday ? (
          <div className="now-line" style={{ top: `${nowTop}%` }}>
            <span className="now-label">{formatClock(new Date(nowMs).toISOString(), tz)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Timeline(props: {
  today: TodayEntries | null;
  week: WeekEntries | null;
  mode: "day" | "week";
  onModeChange: (mode: "day" | "week") => void;
  /** 当前查看的日期（"YYYY-MM-DD" | null = 今天）；Step 3 DateNav 接入 */
  date?: string | null;
  onDateChange?: (date: string | null) => void;
  nowMs: number;
  tz: string;
  dayTotal: number;
  weekTotal: number;
  categories: Category[];
  tags: Tag[];
  onEntryUpdated: () => void;
}) {
  const { t } = useTranslation();
  const {
    today,
    week,
    mode,
    onModeChange,
    date,
    onDateChange,
    nowMs,
    tz,
    dayTotal,
    weekTotal,
    categories,
    tags,
    onEntryUpdated,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDay = mode === "day";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    dayStart: string;
    startedAt: string;
    stoppedAt: string;
  } | null>(null);
  // 拖拽结束后的固化预览块（仅渲染在发起拖拽的那一列），同时作为 draft popover 的 anchor
  const [draftAnchor, setDraftAnchor] = useState<{ dayStart: string; startMs: number; endMs: number } | null>(null);
  const [scale, setScale] = useState<Scale>(60);
  const scaleIndex = SCALES.indexOf(scale);
  const tickCount = 1440 / scale;

  // 选中条目：从当前视图数据中查找；编辑后条目移出视图（或刷新后消失）时自动关闭 popover
  const selectedEntry: TimeEntry | null = selectedId
    ? (isDay
        ? (today?.entries ?? [])
        : (week?.days.flatMap((d) => d.entries) ?? [])
      ).find((e) => e.id === selectedId) ?? null
    : null;

  // 滚动锚点：day 模式为当天（查看过去日期时锚定所查看的日期）；week 模式为 nowMs 所在的那一列
  const anchorDay = isDay
    ? today
    : (week?.days.find((d) => isDayAt(d, nowMs) || d.dayStart === today?.dayStart) ?? null);

  const dayStartMs = anchorDay ? Date.parse(anchorDay.dayStart) : 0;
  const dayEndMs = anchorDay ? Date.parse(anchorDay.dayEnd) : 0;
  const dayMs = dayEndMs - dayStartMs || 1;

  useEffect(() => {
    if (!anchorDay || !scrollRef.current) return;
    const el = scrollRef.current;
    const inner = el.scrollHeight;
    // 查看过去/未来日期时锚定所查看日的正午，否则锚定 now（nowMs 落在窗口内）
    const anchorMs = Math.min(Math.max(nowMs, dayStartMs), dayEndMs - 1);
    const anchorTop = Math.max(0, Math.min(100, ((anchorMs - dayStartMs) / dayMs) * 100));
    const target = (anchorTop / 100) * inner - el.clientHeight / 2;
    el.scrollTop = Math.max(0, target);
    // 仅在视图数据首次加载、切换视图、切换日期或切换刻度档位后滚动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDay != null, mode, anchorDay?.dayStart, scale]);

  const handleDragCreate =
    (dayStart: string) =>
    (d: { startedAt: string; stoppedAt: string }) => {
      const startMs = Date.parse(d.startedAt);
      const endMs = Date.parse(d.stoppedAt);
      setDraft({ dayStart, startedAt: d.startedAt, stoppedAt: d.stoppedAt });
      setDraftAnchor({ dayStart, startMs, endMs });
    };

  const clearDraft = () => {
    setDraft(null);
    setDraftAnchor(null);
  };

  const total = isDay ? dayTotal : weekTotal;

  return (
    <Popover
      open={selectedEntry != null || draft != null}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedId(null);
          clearDraft();
        }
      }}
    >
      <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Tabs
            value={mode}
            onValueChange={(v) => onModeChange(v === "week" ? "week" : "day")}
            aria-label={t("timeline.viewToggle")}
          >
            <TabsList>
              <TabsTrigger value="day">{t("timeline.viewDay")}</TabsTrigger>
              <TabsTrigger value="week">{t("timeline.viewWeek")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={scaleIndex <= 0}
              onClick={() => setScale(SCALES[scaleIndex - 1])}
              aria-label={t("timeline.zoomOut")}
            >
              <Minus />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={scaleIndex >= SCALES.length - 1}
              onClick={() => setScale(SCALES[scaleIndex + 1])}
              aria-label={t("timeline.zoomIn")}
            >
              <Plus />
            </Button>
          </div>
          {onDateChange ? (
            <DateNav view={mode} date={date ?? null} tz={tz} onChange={onDateChange} />
          ) : (
            <span className="truncate font-semibold">
              {isDay
                ? formatDayLabel(tz)
                : week
                  ? formatWeekLabel(week.weekStart, week.weekEnd, tz)
                  : ""}
            </span>
          )}
        </div>
        <span className="font-mono text-sm font-medium tabular-nums">{formatDuration(total)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" ref={scrollRef}>
        {isDay ? (
          <DayColumn
            day={today}
            nowMs={nowMs}
            tz={tz}
            isToday={date == null || (today ? isDayAt(today, nowMs) : true)}
            scale={scale}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDragCreate={today ? handleDragCreate(today.dayStart) : undefined}
            draftAnchor={draftAnchor?.dayStart === today?.dayStart ? draftAnchor : null}
          />
        ) : week ? (
          <div className="flex min-w-full flex-col">
            <div className="flex">
              <div className="w-14 flex-shrink-0" />
              {week.days.map((d, i) => {
                const isToday = isDayAt(d, nowMs);
                const header = formatWeekdayHeader(d.dayStart, tz);
                return (
                  <div
                    key={d.dayStart}
                    className={`flex min-w-[180px] flex-1 flex-col${i === 0 ? "" : " border-l"}`}
                  >
                    <div
                      className={`border-b px-2 py-2 text-center${isToday ? " bg-primary/10" : ""}`}
                    >
                      <div
                        className={`text-2xl font-bold leading-tight${isToday ? " text-primary" : ""}`}
                      >
                        {header.day}
                      </div>
                      <div className="text-xs text-muted-foreground">{header.weekday}</div>
                      <div className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatDuration(d.totalClippedSeconds)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex">
              <div className="timeline-ruler timeline-ruler--static">
                {Array.from({ length: tickCount + 1 }, (_, i) => (
                  <div key={i} className="hour" style={{ top: `${(i / tickCount) * 100}%` }}>
                    {tickLabel(i, scale)}
                  </div>
                ))}
              </div>
              {week.days.map((d) => (
                <div
                  key={d.dayStart}
                  className="flex min-w-[180px] flex-1 flex-col border-l"
                >
                  <DayColumn
                    day={d}
                    nowMs={nowMs}
                    tz={tz}
                    isToday={isDayAt(d, nowMs)}
                    showRuler={false}
                    scale={scale}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onDragCreate={handleDragCreate(d.dayStart)}
                    draftAnchor={draftAnchor?.dayStart === d.dayStart ? draftAnchor : null}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {selectedEntry ? (
        <PopoverContent side="right" align="center" sideOffset={0} className="w-80">
          <EntryEditor
            key={selectedEntry.id}
            entry={selectedEntry}
            categories={categories}
            tags={tags}
            onSaved={() => {
              // 保存成功：关闭 popover 并刷新时间线数据（R5）
              setSelectedId(null);
              onEntryUpdated();
            }}
            onClose={() => setSelectedId(null)}
          />
        </PopoverContent>
      ) : draft ? (
        <PopoverContent side="right" align="center" sideOffset={0} className="w-80">
          <EntryEditor
            key={draft.startedAt}
            draft={{ startedAt: draft.startedAt, stoppedAt: draft.stoppedAt }}
            categories={categories}
            tags={tags}
            onSaved={() => {
              // 保存成功：关闭并刷新时间线数据
              clearDraft();
              onEntryUpdated();
            }}
            onClose={clearDraft}
          />
        </PopoverContent>
      ) : null}
    </section>
    </Popover>
  );
}
