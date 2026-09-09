import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Measurable } from "@radix-ui/rect";
import { Radio } from "lucide-react";
import type { Category, Tag, TimeEntry, TodayEntries } from "../api";
import { formatClock, formatDuration, paletteColor } from "../format";
import { localeFor } from "../i18n";
import type { Gap } from "../timeline-gaps";
import { PopoverAnchor } from "./ui/popover";
import { Separator } from "./ui/separator";

/** 行事件流：条目行与 gap 幽灵卡行合并后的统一渲染单元 */
type Row =
  | { kind: "entry"; key: string; entry: TimeEntry }
  | { kind: "gap"; key: string; gap: Gap; vis: { startMs: number; endMs: number } };

/** 固化锚点快照：点击 gap 时记录该行卡片元素的位置矩形，popover 打开期间
 *  数据刷新重排行也不移位（与块视图 gapAnchor 快照同思路，经由 Measurable 消费）。 */
class RectSnapshot implements Measurable {
  constructor(private readonly rect: DOMRect) {}
  getBoundingClientRect(): DOMRect {
    return this.rect;
  }
}

export function EntryListView(props: {
  day: TodayEntries | null;
  nowMs: number;
  tz: string;
  categories: Category[];
  tags: Tag[];
  /** 当日 gap（全局绝对时刻，已由 Timeline 按视图窗口算好） */
  gaps: Gap[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGapClick?: (gap: Gap) => void;
}) {
  const { t, i18n } = useTranslation();
  const { day, nowMs, tz, categories, tags, gaps, selectedId, onSelect, onGapClick } = props;
  const listRef = useRef<HTMLDivElement>(null);
  // gap 草稿锚点：被点幽灵卡行卡片的固化位置快照（popover 定位 anchor，不随行重排移动）；
  // PopoverAnchor virtualRef 需要 RefObject 形态，快照在点击时写入 ref.current
  const gapAnchorRef = useRef<Measurable | null>(null);
  const [gapAnchorActive, setGapAnchorActive] = useState(false);

  // gap 可见段：与当天窗口求交（跨午夜 gap 截断到本窗口，与块视图 slot 同语义）
  const dayStartMs = day ? Date.parse(day.dayStart) : 0;
  const dayEndMs = day ? Date.parse(day.dayEnd) : 0;

  /** 条目 + gap 按开始时刻合并成时间序事件流，固定正序（柳比歇夫流水账式） */
  const rows = useMemo<Row[]>(() => {
    if (!day) return [];
    const entryRows: Row[] = day.entries.map((e) => ({
      kind: "entry",
      key: `e-${e.id}`,
      entry: e,
    }));
    const gapRows: Row[] = gaps
      .map((gap, i): Row | null => {
        const visStart = Math.max(gap.startMs, dayStartMs);
        const visEnd = Math.min(gap.endMs, dayEndMs);
        if (visEnd - visStart <= 0) return null;
        return {
          kind: "gap",
          key: `g-${i}-${gap.startMs}`,
          gap,
          vis: { startMs: visStart, endMs: visEnd },
        };
      })
      .filter((r): r is Row => r != null);
    return [...entryRows, ...gapRows].sort(
      (a, b) =>
        (a.kind === "entry" ? Date.parse(a.entry.startedAt) : a.vis.startMs) -
        (b.kind === "entry" ? Date.parse(b.entry.startedAt) : b.vis.startMs),
    );
  }, [day, gaps, dayStartMs, dayEndMs]);

  // 初始滚动（挂载/日期切换时执行一次）：今天滚到底（运行中在最后）、
  // 历史日期滚到顶；不做持续跟随
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isToday = day
      ? nowMs >= Date.parse(day.dayStart) && nowMs < Date.parse(day.dayEnd)
      : false;
    el.scrollTop = isToday ? el.scrollHeight : 0;
    // 仅在首次挂载、日期切换时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.dayStart]);

  /** 幽灵卡点击：固化行位置快照作为 popover anchor，再上抛 gap（Timeline 的 gapDraft 流程） */
  const handleGhostClick = (gap: Gap, cardEl: HTMLElement) => {
    gapAnchorRef.current = new RectSnapshot(cardEl.getBoundingClientRect());
    setGapAnchorActive(true);
    onGapClick?.(gap);
  };

  const footerDate = day
    ? new Date(day.dayStart).toLocaleDateString(localeFor(i18n.language), {
        timeZone: tz,
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="entry-view-list min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
            {t("timeline.weekEmpty")}
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-2 pb-6 md:p-4">
            {rows.map((row) =>
              row.kind === "entry" ? (
                <EntryRow
                  key={row.key}
                  entry={row.entry}
                  nowMs={nowMs}
                  tz={tz}
                  categories={categories}
                  tags={tags}
                  selected={selectedId === row.entry.id}
                  onSelect={onSelect}
                />
              ) : (
                <GapRow
                  key={row.key}
                  gap={row.gap}
                  vis={row.vis}
                  tz={tz}
                  onClick={handleGhostClick}
                />
              ),
            )}
            {/* gap 草稿锚点：virtualRef 指向点击时固化的快照（行重排不移位） */}
            {gapAnchorActive && gapAnchorRef.current ? (
              <PopoverAnchor virtualRef={gapAnchorRef} />
            ) : null}
            {/* 结账线（R7）：日期 · 合计 */}
            <div className="entry-view-footer">
              <Separator className="entry-view-footer-line" />
              <div className="pt-2 text-center text-xs text-muted-foreground">
                {t("timeline.entryViewFooter", {
                  date: footerDate,
                  total: formatDuration(day ? day.totalClippedSeconds : 0),
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 单条条目行：时间列（两行式）+ 刻度短线 + 可变高度卡片 */
function EntryRow(props: {
  entry: TimeEntry;
  nowMs: number;
  tz: string;
  categories: Category[];
  tags: Tag[];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { entry: e, nowMs, tz, categories, tags, selected, onSelect } = props;
  const isRunning = !e.stoppedAt;
  const hasDescription = e.description.trim().length > 0;
  const hasTags = e.tags.length > 0;
  const single = !hasDescription && !hasTags;

  const startTime = formatClock(e.startedAt, tz);
  // 运行中下行 `···`；跨午夜结束时间原样 HH:MM（日期语义由导航上下文承担）
  const endTime = isRunning ? "···" : formatClock(e.stoppedAt!, tz);
  const duration = isRunning
    ? Math.max(0, Math.floor((nowMs - Date.parse(e.startedAt)) / 1000))
    : e.durationSeconds;

  // 颜色：分类显式色优先，未设定回退名称 hash 色（防御性回退，同 timeline-block）
  const categoryColor = categories.find((c) => c.id === e.categoryId)?.color ?? null;
  const color = paletteColor(categoryColor, e.categoryName);

  const cardStyle: React.CSSProperties & Record<"--entry-card-color", string> = {
    /* 左缘 3px 分类色竖条（色弱友好双编码，与 timeline-block 色条语言同源）；
       运行中改为透明，由 CSS ::before 呼吸色条接管（避免双条叠加）。
       底色 8% 染色在 CSS 里经 var(--entry-card-color) 消费（内联会压过 :hover 15% 提亮） */
    borderLeft: isRunning ? "3px solid transparent" : `3px solid ${color}`,
    "--entry-card-color": color,
  };

  return (
    <div className="entry-view-row">
      {/* 时间列：两行式（上行开始=锚点亮色，下行结束=补充淡色） */}
      <div className="entry-view-time">
        <span className="entry-view-time--start">{startTime}</span>
        <span className="entry-view-time--end">{endTime}</span>
      </div>
      {/* 刻度短线：轻量「轴节点」串联感 */}
      <div className="entry-view-tick" aria-hidden />
      {/* 卡片：可变高度，不含时间范围（时间归左列、内容归右卡）；
          选中卡内嵌零尺寸锚点钉卡片中心（同 timeline-block 手法） */}
      <div
        role="button"
        tabIndex={0}
        className={`entry-view-card${single ? " entry-view-card--single" : ""}${isRunning ? " entry-view-card--running" : ""}${selected ? " entry-view-card--selected" : ""}`}
        style={cardStyle}
        onClick={isRunning ? undefined : () => onSelect(e.id)}
        onKeyDown={
          isRunning
            ? undefined
            : (ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onSelect(e.id);
                }
              }
        }
      >
        {single ? (
          /* 单行卡（≥44px 触控友好）：分类色点 + 分类名（运行中附 Radio 指示）+ 右对齐时长 */
          <>
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate text-sm">{e.categoryName}</span>
            {isRunning ? (
              <span className="inline-flex shrink-0 items-center text-muted-foreground">
                <Radio className="size-3" aria-hidden />
              </span>
            ) : null}
            <span className="entry-view-dur">{formatDuration(duration)}</span>
          </>
        ) : (
          /* 两行卡：上行描述（无描述降级分类名），下行分类色点 + 分类名 + 标签徽章 + 右对齐时长 */
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-left">
              <span className="font-medium">{hasDescription ? e.description : e.categoryName}</span>
              {isRunning ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Radio className="size-3" aria-hidden />
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                {e.categoryName}
              </span>
              {e.tags.map((tag) => {
                const tagColor = tags.find((x) => x.id === tag.id)?.color ?? null;
                return (
                  <span key={tag.id} className="entry-view-tag">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: paletteColor(tagColor, tag.name) }}
                    />
                    {tag.name}
                  </span>
                );
              })}
              <span className="entry-view-dur">{formatDuration(duration)}</span>
            </div>
          </>
        )}
        {/* 选中卡：零尺寸锚点钉卡片中心，popover 从卡片右侧弹出（同 timeline-block） */}
        {selected ? <PopoverAnchor className="absolute top-1/2 left-1/2 h-0 w-0" /> : null}
      </div>
    </div>
  );
}

/** gap 幽灵卡行：时间列起止两行 + 虚线幽灵卡（高度约正常卡一半） */
function GapRow(props: {
  gap: Gap;
  vis: { startMs: number; endMs: number };
  tz: string;
  onClick: (gap: Gap, cardEl: HTMLElement) => void;
}) {
  const { t } = useTranslation();
  const { gap, vis, tz, onClick } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const duration = Math.floor((gap.endMs - gap.startMs) / 1000);
  return (
    <div className="entry-view-row">
      <div className="entry-view-time">
        <span className="entry-view-time--start">
          {formatClock(new Date(vis.startMs).toISOString(), tz)}
        </span>
        <span className="entry-view-time--end">
          {formatClock(new Date(vis.endMs).toISOString(), tz)}
        </span>
      </div>
      <div className="entry-view-tick" aria-hidden />
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        className="entry-view-ghost"
        title={t("timeline.gapTitle", {
          range: `${formatClock(new Date(gap.startMs).toISOString(), tz)} – ${formatClock(new Date(gap.endMs).toISOString(), tz)}`,
          duration: formatDuration(duration),
        })}
        onClick={() => cardRef.current && onClick(gap, cardRef.current)}
        onKeyDown={(ev) => {
          if ((ev.key === "Enter" || ev.key === " ") && cardRef.current) {
            ev.preventDefault();
            onClick(gap, cardRef.current);
          }
        }}
      >
        {t("timeline.gapGhost", { duration: formatDuration(duration) })}
      </div>
    </div>
  );
}
