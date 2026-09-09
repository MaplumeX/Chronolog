import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, Tag, TimeEntry, TodayEntries } from "../api";
import type { Gap } from "../timeline-gaps";
import { EntryListView } from "./EntryListView";
import { Popover } from "./ui/popover";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案（en.ts 实际值）。
// 时间格式：tz="UTC" + i18n en → formatClock 输出 HH:MM（toLocaleTimeString en、
// hour12:false、UTC），formatDuration 输出 h:mm:ss（语言无关）。

const CATEGORIES: Category[] = [
  { id: "c1", name: "Work", color: 1, parentId: null, archivedAt: null, entryCount: 0 },
];
const TAGS: Tag[] = [{ id: "t1", name: "focus", color: 2, entryCount: 0, parentId: null }];

const DAY_START = "2025-01-06T00:00:00.000Z";
const DAY_END = "2025-01-07T00:00:00.000Z";
/** nowMs 落在 day 窗口内（运行中条目需要） */
const NOW_MS = Date.parse("2025-01-06T12:00:00.000Z");

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "e1",
    categoryId: "c1",
    categoryName: "Work",
    description: "",
    startedAt: "2025-01-06T02:00:00.000Z",
    stoppedAt: "2025-01-06T03:00:00.000Z",
    durationSeconds: 3600,
    tags: [],
    ...overrides,
  };
}

function makeToday(entries: TimeEntry[] = []): TodayEntries {
  return {
    tz: "UTC",
    dayStart: DAY_START,
    dayEnd: DAY_END,
    entries,
    totalClippedSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
  };
}

/** 02:00–03:00 条目 + 04:00–05:00 条目 + 中间 03:00–04:00 空档（全局绝对时刻） */
const ENTRIES_WITH_GAP: TimeEntry[] = [
  makeEntry({ id: "e1", startedAt: "2025-01-06T02:00:00.000Z", stoppedAt: "2025-01-06T03:00:00.000Z" }),
  makeEntry({ id: "e2", startedAt: "2025-01-06T04:00:00.000Z", stoppedAt: "2025-01-06T05:00:00.000Z" }),
];
const MID_GAP: Gap = {
  startMs: Date.parse("2025-01-06T03:00:00.000Z"),
  endMs: Date.parse("2025-01-06T04:00:00.000Z"),
};

/** Popover Root 内渲染（组件内含 PopoverAnchor，radix 要求 Popover context） */
function renderList(props?: {
  day?: TodayEntries | null;
  nowMs?: number;
  gaps?: Gap[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onGapClick?: (gap: Gap) => void;
}) {
  const onSelect = props?.onSelect ?? vi.fn();
  const onGapClick = props?.onGapClick ?? vi.fn();
  render(
    <Popover open={false} onOpenChange={() => {}}>
      <EntryListView
        day={props?.day ?? makeToday(ENTRIES_WITH_GAP)}
        nowMs={props?.nowMs ?? NOW_MS}
        tz="UTC"
        categories={CATEGORIES}
        tags={TAGS}
        gaps={props?.gaps ?? [MID_GAP]}
        selectedId={props?.selectedId ?? null}
        onSelect={onSelect}
        onGapClick={onGapClick}
      />
    </Popover>,
  );
  return { onSelect, onGapClick };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("EntryListView", () => {
  it("渲染行数 = 条目数 + 可见 gap 数（合并时间序事件流）", () => {
    renderList();
    // 2 条目行 + 1 gap 幽灵卡行
    expect(document.querySelectorAll(".entry-view-card").length).toBe(2);
    expect(document.querySelectorAll(".entry-view-ghost").length).toBe(1);
    expect(document.querySelectorAll(".entry-view-row").length).toBe(3);
  });

  it("时间列两行式：上行开始 HH:MM、下行结束 HH:MM；运行中下行显示 ···", () => {
    renderList({
      day: makeToday([
        makeEntry({
          id: "e1",
          startedAt: "2025-01-06T08:12:00.000Z",
          stoppedAt: "2025-01-06T09:30:00.000Z",
        }),
        makeEntry({
          id: "e2",
          startedAt: "2025-01-06T10:00:00.000Z",
          stoppedAt: null,
          durationSeconds: 7200,
        }),
      ]),
      gaps: [],
    });
    const rows = document.querySelectorAll<HTMLElement>(".entry-view-row");
    expect(rows.length).toBe(2);

    const first = rows[0];
    expect(first.querySelector(".entry-view-time--start")!.textContent).toBe("08:12");
    expect(first.querySelector(".entry-view-time--end")!.textContent).toBe("09:30");

    // 运行中（nowMs 在 day 窗口内）：下行 ···
    const running = rows[1];
    expect(running.querySelector(".entry-view-time--start")!.textContent).toBe("10:00");
    expect(running.querySelector(".entry-view-time--end")!.textContent).toBe("···");
  });

  it("单行/两行卡切换：无描述无标签 → 单行卡；有描述或标签 → 两行卡", () => {
    renderList({
      day: makeToday([
        // 单行：无描述无标签
        makeEntry({ id: "e1", stoppedAt: "2025-01-06T01:00:00.000Z" }),
        // 两行：有描述
        makeEntry({
          id: "e2",
          description: "Deep work",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
        // 两行：无描述但有标签
        makeEntry({
          id: "e3",
          startedAt: "2025-01-06T04:00:00.000Z",
          stoppedAt: "2025-01-06T05:00:00.000Z",
          tags: [{ id: "t1", name: "focus" }],
        }),
      ]),
      gaps: [],
    });
    const cards = document.querySelectorAll(".entry-view-card");
    expect(cards.length).toBe(3);
    expect(cards[0].classList.contains("entry-view-card--single")).toBe(true);
    expect(cards[1].classList.contains("entry-view-card--single")).toBe(false);
    expect(cards[2].classList.contains("entry-view-card--single")).toBe(false);

    // 单行卡：分类名 + 右对齐时长，无描述主行
    expect(cards[0].textContent).toContain("Work");
    expect(screen.getAllByText("1:00:00").length).toBe(3);

    // 两行卡（有描述）：描述主行 + 分类名
    expect(screen.getByText("Deep work")).toBeInTheDocument();
    // 两行卡（无描述有标签）：上行降级分类名 + 标签徽章
    expect(screen.getByText("focus")).toBeInTheDocument();
  });

  it("点击卡片 → onSelect(id)；运行中卡片点击无效", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderList({
      day: makeToday([
        makeEntry({ id: "e1", stoppedAt: "2025-01-06T01:00:00.000Z" }),
        makeEntry({ id: "e2", startedAt: "2025-01-06T10:00:00.000Z", stoppedAt: null }),
      ]),
      gaps: [],
      onSelect,
    });
    const cards = document.querySelectorAll<HTMLElement>(".entry-view-card");
    await user.click(cards[0]);
    expect(onSelect).toHaveBeenCalledWith("e1");

    // 运行中卡片：onClick 为 undefined（纯展示）
    await user.click(cards[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("点击幽灵卡 → onGapClick(gap)，gap 为全局绝对时刻", async () => {
    const user = userEvent.setup();
    const onGapClick = vi.fn();
    renderList({ onGapClick });
    const ghost = document.querySelector<HTMLElement>(".entry-view-ghost");
    expect(ghost).not.toBeNull();
    await user.click(ghost!);
    expect(onGapClick).toHaveBeenCalledTimes(1);
    expect(onGapClick).toHaveBeenCalledWith(MID_GAP);
  });

  it("固定正序渲染：首行时间列 = 最早开始条目", () => {
    renderList({
      day: makeToday([
        makeEntry({
          id: "e1",
          startedAt: "2025-01-06T04:00:00.000Z",
          stoppedAt: "2025-01-06T05:00:00.000Z",
        }),
        makeEntry({
          id: "e2",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
      ]),
      gaps: [],
    });
    // 输入顺序与渲染无关：首行始终是开始最早的条目（02:00）
    const firstStart = document.querySelector<HTMLElement>(
      ".entry-view-row .entry-view-time--start",
    )!;
    expect(firstStart.textContent).toBe("02:00");
    // 不再读写 chronolog-entry-view-sort
    expect(window.localStorage.getItem("chronolog-entry-view-sort")).toBeNull();
  });

  it("空状态：无条目显示「No entries」", () => {
    renderList({ day: makeToday([]), gaps: [] });
    expect(screen.getByText("No entries")).toBeInTheDocument();
    expect(document.querySelector(".entry-view-card")).toBeNull();
  });

  it("结账线：底部显示 日期 · 合计 文本", () => {
    renderList();
    // 2025-01-06 + 2h（两条 1h 条目）→ en locale month long + day numeric
    const footer = document.querySelector(".entry-view-footer");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toContain("January 6");
    expect(footer!.textContent).toContain("2:00:00");
  });
});
