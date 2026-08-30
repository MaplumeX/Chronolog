import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BoundaryEntries, Category, Tag, TimeEntry, TodayEntries, WeekEntries } from "../api";
import {
  clipRangeMs,
  formatClock,
  formatDayLabel,
  formatDuration,
  formatEntryTimeRange,
  formatWeekLabel,
  formatWeekdayHeader,
  paletteColor,
  paletteForegroundColor,
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

/** 空档：全局绝对时刻（可跨天/跨多天）；点击后以其起止创建条目 */
export type Gap = { startMs: number; endMs: number };

/** gap 可见段最小像素高度：低于则不渲染插槽 */
const MIN_SLOT_PX = 10;

/**
 * 计算视图窗口内全部条目（含 boundary 外邻）之间的空档（design §4）：
 * 把窗口内条目（运行中按 nowMs 为右端）与 prevEntry/nextEntry 合并为覆盖区间序列，
 * gap = 相邻区间之间的空隙，输出全局绝对时刻（可跨天/跨多天）。各列渲染时与自身窗口求交：
 * - 列内相邻条目、跨午夜条目前后、空列（多天空档中间投影，需双侧 boundary 都存在）自然正确；
 * - prevEntry 缺失则首条前无 gap，nextEntry 缺失则末条后无 gap（R1/R3，
 *   同样适用于空列：单侧缺失不渲染，无另一侧边界不算「两个已有条目之间」）。
 */
function computeGaps(
  viewWindow: { startMs: number; endMs: number },
  entries: TimeEntry[],
  boundary: { prevEntry: TimeEntry | null; nextEntry: TimeEntry | null } | null,
  nowMs: number,
): Gap[] {
  const { startMs: wStart, endMs: wEnd } = viewWindow;
  if (wEnd <= wStart) return [];

  // 覆盖区间：运行中条目右端 = nowMs（同用户唯一 running，无后继）
  const rightEdge = (e: TimeEntry) =>
    e.stoppedAt ? Date.parse(e.stoppedAt) : nowMs;
  // 去重：周视图同一条目会出现在多个 day bucket（跨午夜）
  const byId = new Map<string, { start: number; end: number }>();
  for (const e of entries) {
    byId.set(e.id, { start: Date.parse(e.startedAt), end: rightEdge(e) });
  }
  const intervals = [...byId.values()].sort((a, b) => a.start - b.start);

  const gaps: Gap[] = [];
  const push = (startMs: number, endMs: number) => {
    if (endMs - startMs <= 0) return;
    // 只保留与视图窗口有交集的 gap（外邻之前的空隙不关心）
    if (endMs <= wStart || startMs >= wEnd) return;
    gaps.push({ startMs, endMs });
  };

  const prev = boundary?.prevEntry ?? null;
  const next = boundary?.nextEntry ?? null;

  // 前邻是运行中条目（右端 = nowMs 仍在推进，覆盖窗口起点）：窗口起点侧无空档
  if (prev && !prev.stoppedAt) return gaps;

  if (intervals.length === 0) {
    // 空窗口：仅两侧**都**存在边界条目时渲染（= 跨多天空档的中间投影）。
    // 单侧存在（未来无条目日 / 有史以来最早条目之前的日期）或双侧缺失
    // （新用户零条目 / boundary 请求失败降级）都不渲染——「两个已有条目」
    // 之间才算 gap（R1/R3），单侧没有另一侧边界（design §4 规则 4、§6）
    if (!prev || !next) return gaps;
    push(rightEdge(prev), Date.parse(next.startedAt));
    return gaps;
  }

  // 顶部：prevEntry 右端 → 首条（prevEntry 跨午夜伸入窗口时它也在 entries 里，
  // 排序后首条即它，gap 非正被跳过，公式自动正确）
  if (prev) push(rightEdge(prev), intervals[0].start);
  // 相邻区间之间（含跨列、跨午夜条目两侧）
  for (let i = 0; i + 1 < intervals.length; i++) {
    push(intervals[i].end, intervals[i + 1].start);
  }
  // 底部：末条右端 → nextEntry.startedAt
  if (next) push(intervals[intervals.length - 1].end, Date.parse(next.startedAt));
  return gaps;
}

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
  /** gap 插槽：该列可见窗口内的空档（全局绝对时刻） */
  gaps?: Gap[];
  onGapClick?: (gap: Gap, vis: { startMs: number; endMs: number }) => void;
  /** gap 草稿锚点：被点击 slot 可见段的固化快照，作为 draft popover 的定位 anchor（不随 gap 重算移动） */
  gapAnchor?: { startMs: number; endMs: number } | null;
  /** 分类/标签列表（含显式色），条目块/tag 徽章优先用用户设定色，未设定回退 hash 色 */
  categories: Category[];
  tags: Tag[];
}) {
  const { t } = useTranslation();
  const {
    day,
    nowMs,
    tz,
    isToday,
    showRuler = true,
    scale,
    selectedId,
    onSelect,
    onDragCreate,
    draftAnchor,
    gaps,
    onGapClick,
    gapAnchor,
    categories,
    tags,
  } = props;

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
    // 命中 gap 插槽：走点击创建流程，不触发拖拽预览
    if ((e.target as Element).closest(".timeline-slot")) return;
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
              // 几何：起止夹到当天窗口（跨天条目昨晚→今天 在本列从 00:00 起，不多画）
              const { startMs, endMs } = clipRangeMs(
                Date.parse(e.startedAt),
                e.stoppedAt ? Date.parse(e.stoppedAt) : null,
                dayStartMs,
                dayEndMs,
                nowMs,
              );
              const top = posPercent(startMs);
              const heightPct = Math.max(
                0,
                Math.min(100 - top, ((endMs - startMs) / dayMs) * 100),
              );
              const isRunning = !e.stoppedAt;
              // 块上/tooltip 时长用整条总时长（后端已算，running 随 now 增长），列头合计仍按切片
              const secs = e.durationSeconds;
              const timeRange = formatEntryTimeRange(e.startedAt, e.stoppedAt, tz, nowMs);
              // 颜色：分类显式色优先，未设定回退名称 hash 色（hash 逻辑不可改动）
              const categoryColor = categories.find((c) => c.id === e.categoryId)?.color ?? null;
              const color = paletteColor(categoryColor, e.categoryName);
              const textColor = paletteForegroundColor(categoryColor, e.categoryName);
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
                          {e.tags.map((tag) => {
                            const tagColor = tags.find((x) => x.id === tag.id)?.color ?? null;
                            return (
                              <span key={tag.id} className="block-tag">
                                <span
                                  className="size-1.5 shrink-0 rounded-full"
                                  style={{ background: paletteColor(tagColor, tag.name) }}
                                />
                                {tag.name}
                              </span>
                            );
                          })}
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
                /* 半透明底色：透出轨道背景（小元素色点/条形仍用实色 categoryColor） */
                background: `color-mix(in srgb, ${color} 50%, transparent)`,
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

        {gaps && onGapClick
          ? gaps.map((gap, i) => {
              // 可见段：gap 与本列窗口求交；像素高度低于阈值不渲染（R5/AC5）
              const visStart = Math.max(gap.startMs, dayStartMs);
              const visEnd = Math.min(gap.endMs, dayEndMs);
              const visPx = ((visEnd - visStart) / dayMs) * innerHeightFor(scale);
              if (visPx < MIN_SLOT_PX) return null;
              const top = posPercent(visStart);
              const heightPct = ((visEnd - visStart) / dayMs) * 100;
              const range = `${formatClock(new Date(gap.startMs).toISOString(), tz)} – ${formatClock(
                new Date(gap.endMs).toISOString(),
                tz,
              )}`;
              const title = t("timeline.gapTitle", {
                range,
                duration: formatDuration((gap.endMs - gap.startMs) / 1000),
              });
              return (
                <div
                  key={`slot-${i}-${gap.startMs}`}
                  className="timeline-slot"
                  style={{ top: `${top}%`, height: `${heightPct}%` }}
                  title={title}
                  onClick={() => onGapClick(gap, { startMs: visStart, endMs: visEnd })}
                />
              );
            })
          : null}

        {gapAnchor ? (
          // gap 草稿的固化锚点：点击 slot 时快照其可见段，popover 打开期间 gap 数据刷新也不移位
          // （与拖拽 draft 的 draftAnchor 同手法，不依赖实时重算的 gaps 匹配）
          <div
            className="pointer-events-none absolute right-0 left-0"
            style={{
              top: `${((gapAnchor.startMs - dayStartMs) / dayMs) * 100}%`,
              height: `${((gapAnchor.endMs - gapAnchor.startMs) / dayMs) * 100}%`,
            }}
          >
            <PopoverAnchor className="absolute top-1/2 left-1/2 h-0 w-0" />
          </div>
        ) : null}

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
  /** 当前视图窗口的紧邻外侧条目（gap 插槽边界）；null 时只渲染列内 gap */
  boundary?: BoundaryEntries | null;
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
    boundary,
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
  // gap 草稿：点击 slot 时的完整空档（全局时刻，可跨天）+ 被点 slot 可见段的固化快照
  // （快照仅作 popover anchor 定位，不随 gap 数据重算移动，避免 popover 飞出屏幕）
  const [gapDraft, setGapDraft] = useState<{
    dayStart: string;
    startedAt: string;
    stoppedAt: string;
    anchor: { dayStart: string; startMs: number; endMs: number };
  } | null>(null);

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
    setGapDraft(null);
  };

  /**
   * 全局 gap 计算：视图窗口内全部条目 + boundary 外邻 → 相邻区间之间的空隙（design §4）
   */
  const gaps = useMemo(() => {
    const viewEntries = isDay
      ? (today?.entries ?? [])
      : (week?.days.flatMap((d) => d.entries) ?? []);
    const viewStart = isDay
      ? (today ? Date.parse(today.dayStart) : 0)
      : (week ? Date.parse(week.weekStart) : 0);
    const viewEnd = isDay
      ? (today ? Date.parse(today.dayEnd) : 0)
      : (week ? Date.parse(week.weekEnd) : 0);
    if (!viewEnd) return [];
    return computeGaps(
      { startMs: viewStart, endMs: viewEnd },
      viewEntries,
      boundary ?? null,
      nowMs,
    );
  }, [today, week, boundary, nowMs, isDay]);

  /** 指定列可见窗口内的 gap 段（与全局 gap 求交；可见段可多个，但同列内各 gap 互不重叠） */
  const gapsFor = (day: TodayEntries | null): Gap[] => {
    if (!day) return [];
    const startMs = Date.parse(day.dayStart);
    const endMs = Date.parse(day.dayEnd);
    return gaps.filter((g) => g.endMs > startMs && g.startMs < endMs);
  };

  const todayGaps = useMemo(() => gapsFor(today), [gaps, today]);
  const weekGaps = useMemo(
    () => (week ? week.days.map((d) => gapsFor(d)) : []),
    [gaps, week],
  );

  /** slot 点击：以整个空档的起止时间创建草稿，复用既有 draft popover 流程（R6/AC2）；
   *  anchor 快照固化被点 slot 的可见段，popover 打开期间 gap 刷新也不移位 */
  const handleGapClick =
    (dayStart: string) =>
    (gap: Gap, vis: { startMs: number; endMs: number }): void => {
      // 关闭可能打开的编辑 popover，避免两个状态叠加
      setSelectedId(null);
      setDraft(null);
      setDraftAnchor(null);
      setGapDraft({
        dayStart,
        startedAt: new Date(gap.startMs).toISOString(),
        stoppedAt: new Date(gap.endMs).toISOString(),
        anchor: { dayStart, startMs: vis.startMs, endMs: vis.endMs },
      });
    };

  const total = isDay ? dayTotal : weekTotal;

  return (
    <Popover
      open={selectedEntry != null || draft != null || gapDraft != null}
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
            <span className="truncate text-sm font-semibold tracking-tight">
              {isDay
                ? formatDayLabel(tz)
                : week
                  ? formatWeekLabel(week.weekStart, week.weekEnd, tz)
                  : ""}
            </span>
          )}
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums">{formatDuration(total)}</span>
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
            gaps={todayGaps}
            onGapClick={today ? handleGapClick(today.dayStart) : undefined}
            gapAnchor={
              gapDraft && gapDraft.anchor.dayStart === today?.dayStart ? gapDraft.anchor : null
            }
            categories={categories}
            tags={tags}
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
              {week.days.map((d, i) => (
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
                    gaps={weekGaps[i]}
                    onGapClick={handleGapClick(d.dayStart)}
                    gapAnchor={gapDraft?.anchor.dayStart === d.dayStart ? gapDraft.anchor : null}
                    categories={categories}
                    tags={tags}
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
      ) : draft || gapDraft ? (
        <PopoverContent side="right" align="center" sideOffset={0} className="w-80">
          <EntryEditor
            key={(gapDraft ?? draft)!.startedAt}
            draft={{
              startedAt: (gapDraft ?? draft)!.startedAt,
              stoppedAt: (gapDraft ?? draft)!.stoppedAt,
            }}
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
