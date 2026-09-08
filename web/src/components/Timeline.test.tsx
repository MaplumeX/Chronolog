import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Tag, TodayEntries, WeekEntries } from "../api";
import { useIsMobile } from "../hooks/use-mobile";
import { Timeline } from "./Timeline";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。

vi.mock("../hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));

const useIsMobileMock = vi.mocked(useIsMobile);

/** Timeline 顶层 Popover（Radix）需要 window.matchMedia（jsdom 未提供）。 */
function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList),
  );
}

/** jsdom 的 HTMLElement 缺 pointer capture API（拖拽 handler 依赖），补最小实现。 */
function stubPointerCapture() {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const captured = new WeakMap<HTMLElement, Set<number>>();
  proto.setPointerCapture = function (this: HTMLElement, id: number) {
    let s = captured.get(this);
    if (!s) {
      s = new Set();
      captured.set(this, s);
    }
    s.add(id);
  };
  proto.releasePointerCapture = function (this: HTMLElement, id: number) {
    captured.get(this)?.delete(id);
  };
  proto.hasPointerCapture = function (this: HTMLElement, id: number) {
    return captured.get(this)?.has(id) ?? false;
  };
}

/** track 的 getBoundingClientRect（jsdom 全 0）→ 375px 视口内的 960px 高轨道。 */
function stubTrackRect() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("timeline-track")) {
        return {
          x: 44, y: 120, top: 120, bottom: 1080, left: 44, right: 419,
          width: 375, height: 960, toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0,
        width: 0, height: 0, toJSON: () => ({}),
      } as DOMRect;
    },
  );
}

const CATEGORIES: Category[] = [
  { id: "c1", name: "Work", color: 1, parentId: null, archivedAt: null, entryCount: 0 },
];
const TAGS: Tag[] = [];
const NOW_MS = Date.parse("2025-01-06T12:00:00.000Z"); // 2025-01-06 周一

function makeEntry(overrides: Partial<import("../api").TimeEntry>) {
  return {
    id: "e1",
    categoryId: "c1",
    categoryName: "Work",
    description: "Task",
    startedAt: "2025-01-06T02:00:00.000Z",
    stoppedAt: "2025-01-06T03:00:00.000Z",
    durationSeconds: 3600,
    tags: [],
    ...overrides,
  };
}

function makeToday(entries: import("../api").TimeEntry[] = []): TodayEntries {
  return {
    tz: "UTC",
    dayStart: "2025-01-06T00:00:00.000Z",
    dayEnd: "2025-01-07T00:00:00.000Z",
    entries,
    totalClippedSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
  };
}

function makeWeek(): WeekEntries {
  return {
    tz: "UTC",
    weekStart: "2025-01-06T00:00:00.000Z",
    weekEnd: "2025-01-13T00:00:00.000Z",
    days: Array.from({ length: 7 }, (_, i) =>
      makeToday(i === 0 ? [makeEntry({})] : []),
    ).map((d, i) => ({
      ...d,
      dayStart: `2025-01-0${6 + i}T00:00:00.000Z`,
      dayEnd: `2025-01-0${7 + i}T00:00:00.000Z`,
    })),
  };
}

/** 渲染 day 模式 Timeline；onEntryUpdated 挂 spy 便于断言（保存路径不在本测试范围）。 */
function renderTimeline(props?: {
  mode?: "day" | "week";
  today?: TodayEntries | null;
  week?: WeekEntries | null;
}) {
  const onEntryUpdated = vi.fn();
  render(
    <Timeline
      today={props?.today ?? makeToday()}
      week={props?.week ?? makeWeek()}
      mode={props?.mode ?? "day"}
      onModeChange={() => {}}
      nowMs={NOW_MS}
      tz="UTC"
      dayTotal={3600}
      weekTotal={3600}
      categories={CATEGORIES}
      tags={TAGS}
      onEntryUpdated={onEntryUpdated}
    />,
  );
  return onEntryUpdated;
}

const trackEl = () =>
  document.querySelector<HTMLElement>(".timeline-track")!;

/** 在 track 上派发 PointerEvent。React 19 对 pointermove/up（continuous 事件）异步批处理，
 *  每步需 await act() flush 后再断言。 */
async function fireTrackPointer(type: string, y: number) {
  await act(async () => {
    trackEl().dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
        clientY: 120 + (y / 100) * 960,
      }),
    );
  });
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("Timeline 拖拽创建（day 视图）", () => {
  beforeEach(() => {
    stubMatchMedia();
    stubPointerCapture();
    useIsMobileMock.mockReturnValue(false);
  });

  it("桌面端（非触屏）：pointer 拖拽后出现新建草稿编辑器", async () => {
    stubTrackRect();
    renderTimeline();
    // 10:00 → 11:00（scale 60，snap 15min）
    await fireTrackPointer("pointerdown", (10 / 24) * 100);
    await fireTrackPointer("pointermove", (11 / 24) * 100);
    await fireTrackPointer("pointerup", (11 / 24) * 100);
    expect(screen.getByText("New entry")).toBeInTheDocument();
  });

  it("移动端（<768px）：pointer 拖拽不创建草稿", async () => {
    stubTrackRect();
    useIsMobileMock.mockReturnValue(true);
    renderTimeline();
    await fireTrackPointer("pointerdown", (10 / 24) * 100);
    await fireTrackPointer("pointermove", (11 / 24) * 100);
    await fireTrackPointer("pointerup", (11 / 24) * 100);
    expect(screen.queryByText("New entry")).toBeNull();
    expect(document.querySelector(".drag-preview")).toBeNull();
  });

  it("移动端：点击 gap 插槽可打开新建草稿编辑器（触屏唯一创建路径）", async () => {
    useIsMobileMock.mockReturnValue(true);
    // 02:00–03:00 条目 + 04:00–05:00 条目，中间 03:00–04:00 为空档
    renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
        makeEntry({
          id: "e2",
          startedAt: "2025-01-06T04:00:00.000Z",
          stoppedAt: "2025-01-06T05:00:00.000Z",
        }),
      ]),
    });
    const slots = document.querySelectorAll(".timeline-slot");
    expect(slots.length).toBeGreaterThan(0);
    await act(async () => {
      slots[0].dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    expect(screen.getByText("New entry")).toBeInTheDocument();
  });
});

describe("Timeline week 视图", () => {
  beforeEach(() => {
    stubMatchMedia();
    stubPointerCapture();
    useIsMobileMock.mockReturnValue(false);
  });
  it("渲染 7 列与共享刻度尺，移动端拖拽不创建草稿", async () => {
    stubTrackRect();
    useIsMobileMock.mockReturnValue(true);
    renderTimeline({ mode: "week" });
    // 7 列 track（week 模式 DayColumn 无 ruler，track 占满列）
    expect(document.querySelectorAll(".timeline-track").length).toBe(7);
    // 共享静态 ruler 恰好一个
    expect(document.querySelectorAll(".timeline-ruler--static").length).toBe(1);
    // 在第一列 track 上拖拽：不创建草稿
    await fireTrackPointer("pointerdown", (10 / 24) * 100);
    await fireTrackPointer("pointermove", (11 / 24) * 100);
    await fireTrackPointer("pointerup", (11 / 24) * 100);
    expect(screen.queryByText("New entry")).toBeNull();
  });
});

describe("Timeline day 子视图（块/条目切换）", () => {
  beforeEach(() => {
    stubMatchMedia();
    stubPointerCapture();
    useIsMobileMock.mockReturnValue(false);
  });

  it("day 模式：点击「条目」按钮切换到条目视图，再切回块视图", async () => {
    // 默认 block：渲染 .timeline-track（today 带一条条目）
    renderTimeline({ today: makeToday([makeEntry({})]) });
    expect(document.querySelector(".timeline-track")).not.toBeNull();
    expect(document.querySelector(".entry-view-list")).toBeNull();

    // 点击「条目」子视图按钮（aria-label = timeline.viewEntries 英文文案）
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Entries" }));
    // EntryListView 替代 DayColumn：块视图轨道消失，出现 .entry-view-* DOM + 结账线
    expect(document.querySelector(".timeline-track")).toBeNull();
    expect(document.querySelector(".entry-view-list")).not.toBeNull();
    expect(document.querySelector(".entry-view-card")).not.toBeNull();
    expect(document.querySelector(".entry-view-footer")).not.toBeNull();
    // 缩放按钮（±）仅 block 子视图显示
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    // 切换记忆落到 localStorage
    expect(window.localStorage.getItem("chronolog-day-subview")).toBe("entries");

    // 切回块视图：.timeline-track 恢复，缩放按钮回来
    await user.click(screen.getByRole("button", { name: "Blocks" }));
    expect(document.querySelector(".timeline-track")).not.toBeNull();
    expect(document.querySelector(".entry-view-list")).toBeNull();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(window.localStorage.getItem("chronolog-day-subview")).toBe("block");
  });

  it("week 模式：无子视图切换按钮（无 Entries/Blocks）", () => {
    renderTimeline({ mode: "week" });
    expect(screen.queryByRole("button", { name: "Entries" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Blocks" })).toBeNull();
    // week 模式仍然渲染 7 列块视图
    expect(document.querySelectorAll(".timeline-track").length).toBe(7);
  });

  it("子视图记忆：localStorage chronolog-day-subview=entries 时挂载直接渲染条目视图", () => {
    window.localStorage.setItem("chronolog-day-subview", "entries");
    renderTimeline();
    expect(document.querySelector(".entry-view-list")).not.toBeNull();
    expect(document.querySelector(".timeline-track")).toBeNull();
  });
});
