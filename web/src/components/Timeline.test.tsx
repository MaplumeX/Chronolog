import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
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
  boundary?: import("../api").BoundaryEntries | null;
}) {
  const onEntryUpdated = vi.fn();
  render(
    <Timeline
      today={props?.today ?? makeToday()}
      week={props?.week ?? makeWeek()}
      boundary={props?.boundary}
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

/** 合并流程：jsdom 下 Radix Dialog 的 pointer-events 拦截与 user-event 冲突 → 关闭检查 */
function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 打开某条目的编辑器：点击对应描述文本的已停止色块 */
async function openEditor(entryId: string) {
  const target = [...document.querySelectorAll(".timeline-block")].find(
    (el) => el.textContent?.includes("Entry-" + entryId),
  );
  expect(target).toBeTruthy();
  await act(async () => {
    target!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

const SCALE_KEY = "chronolog-scale";

/** 点 −/+ 档位按钮（Zoom out / Zoom in 的 aria-label）。 */
async function clickScaleButton(label: "Zoom out" | "Zoom in") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: label }));
  });
}

describe("Timeline 比例档位持久化", () => {
  beforeEach(() => {
    stubMatchMedia();
    stubPointerCapture();
    useIsMobileMock.mockReturnValue(false);
  });

  it("localStorage 预设 15 → 初始档位为 15（刻度总数 96）", () => {
    window.localStorage.setItem(SCALE_KEY, "15");
    renderTimeline();
    // 每刻度 15 分钟：1440/15 = 96 格，刻度标签 0..96 → 97 个
    expect(document.querySelectorAll(".timeline-ruler .hour").length).toBe(97);
  });

  it("未预设任何值 → 初始档位为 60（默认）", () => {
    renderTimeline();
    expect(document.querySelectorAll(".timeline-ruler .hour").length).toBe(25);
  });

  it("localStorage 预设垃圾值 → 初始档位回退 60", () => {
    window.localStorage.setItem(SCALE_KEY, "7");
    renderTimeline();
    expect(document.querySelectorAll(".timeline-ruler .hour").length).toBe(25);
  });

  it("点击放大按钮后档位写入 localStorage", async () => {
    renderTimeline();
    await clickScaleButton("Zoom in"); // 60 → 30
    expect(window.localStorage.getItem(SCALE_KEY)).toBe("30");
    expect(document.querySelectorAll(".timeline-ruler .hour").length).toBe(49);
  });

  it("点击缩小按钮后档位写入 localStorage；最粗档位按钮禁用", async () => {
    window.localStorage.setItem(SCALE_KEY, "15");
    renderTimeline();
    await clickScaleButton("Zoom out"); // 15 → 30（SCALES = [60, 30, 15, 5] 相邻档）
    expect(window.localStorage.getItem(SCALE_KEY)).toBe("30");
    await clickScaleButton("Zoom out"); // 30 → 60
    expect(window.localStorage.getItem(SCALE_KEY)).toBe("60");
    // 60 是最粗档：缩小按钮禁用
    expect(
      (screen.getByRole("button", { name: "Zoom out" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("localStorage.getItem 抛异常（隐私模式）→ 初始档位为 60 且不炸", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    renderTimeline();
    expect(document.querySelectorAll(".timeline-ruler .hour").length).toBe(25);
  });

  it("localStorage.setItem 抛异常（隐私模式）→ 切档仅内存态生效，不报错", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    renderTimeline();
    await clickScaleButton("Zoom in"); // 60 → 30
    expect(document.querySelectorAll(".timeline-ruler .hour").length).toBe(49);
  });
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
    // 移动端：底部 sheet 弹层打开，编辑器内容在其内（sr-only SheetTitle 与可见 h3 均为
    // "New entry"，用 getAllByText 避免歧义）
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    expect(screen.getAllByText("New entry").length).toBeGreaterThan(0);
  });
});

describe("Timeline 移动端编辑底部弹层", () => {
  beforeEach(() => {
    stubMatchMedia();
    stubPointerCapture();
    useIsMobileMock.mockReturnValue(true);
  });

  it("day/block 子视图：点击已停止条目块 → 底部 sheet 打开 → 保存调用 updateEntry → onSaved 后关闭", async () => {
    const fetchFn = vi.fn(
      (_path: string, _init: RequestInit) => jsonResponse({ entry: { id: "e1" } }),
    );
    vi.stubGlobal("fetch", fetchFn);
    const onEntryUpdated = renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
      ]),
    });
    await openEditor("e1");
    // 底部 sheet 打开（而非 popover），编辑器内容在 sheet 内
    const sheet = document.querySelector('[data-slot="sheet-content"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain("Edit entry");
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).toBeNull();

    // 保存：分类已预填（编辑模式），直接点 Save
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onEntryUpdated).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/entries/e1");
    expect(init.method).toBe("PATCH");
    // onSaved 后 sheet 关闭
    await waitFor(() =>
      expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull(),
    );
  });

  it("移动端 sheet 点取消 → onClose 关闭弹层、不调 api", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
      ]),
    });
    await openEditor("e1");
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull(),
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("entries 子视图：点击条目卡打开 sheet；渲染本身不因无 Popover Root 的锚点报错（风险 1）", async () => {
    renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
      ]),
    });
    // 切到 entries 子视图（风险 1：EntryListView 内的 PopoverAnchor 无桌面 Root）
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Entries" }));
    expect(document.querySelector(".entry-view-list")).not.toBeNull();
    // 点击已停止条目卡打开 sheet
    const card = document.querySelector<HTMLElement>(".entry-view-card");
    expect(card).not.toBeNull();
    await act(async () => {
      card!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    const sheet = document.querySelector('[data-slot="sheet-content"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain("Edit entry");
  });

  it("entries 子视图：点击 gap 幽灵卡打开新建 sheet（virtualRef 锚点不抛错）", async () => {
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
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Entries" }));
    const ghost = document.querySelector<HTMLElement>(".entry-view-ghost");
    expect(ghost).not.toBeNull();
    await act(async () => {
      ghost!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    const sheet = document.querySelector('[data-slot="sheet-content"]');
    expect(sheet).not.toBeNull();
    expect(screen.getAllByText("New entry").length).toBeGreaterThan(0);
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

describe("Timeline 相邻条目合并", () => {
  beforeEach(() => {
    stubMatchMedia();
    stubPointerCapture();
    useIsMobileMock.mockReturnValue(false);
  });

  it("两条相邻条目：编辑器中「与上一条合并」可用，确认后 POST merge + 刷新", async () => {
    const fetchFn = vi.fn(
      (_path: string, _init: RequestInit) => jsonResponse({ entry: { id: "e1" } }),
    );
    vi.stubGlobal("fetch", fetchFn);
    const onEntryUpdated = renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
        makeEntry({
          id: "e2",
          description: "Entry-e2",
          startedAt: "2025-01-06T04:00:00.000Z",
          stoppedAt: "2025-01-06T05:00:00.000Z",
        }),
      ]),
    });
    // 点击 e2（较晚条）打开编辑器
    await openEditor("e2");
    expect(screen.getByText("Edit entry")).toBeInTheDocument();
    // e2 有前驱 e1 → 按钮可用；无后继 → 「与下一条」禁用
    const mergePrev = screen.getByRole("button", { name: "Merge with previous" });
    expect(mergePrev).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Merge with next" }),
    ).toBeDisabled();

    const user = setupUser();
    await user.click(mergePrev);
    // MergeDialog 打开：两张预览卡，默认选中当前条目（This entry）
    expect(screen.getByText("Merge entries")).toBeInTheDocument();
    expect(screen.getByText("This entry").closest("button")!).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("Adjacent entry").closest("button")!,
    ).toHaveAttribute("aria-pressed", "false");

    // 选择保留相邻条目属性后确认
    await user.click(screen.getByText("Adjacent entry"));
    await user.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() => expect(onEntryUpdated).toHaveBeenCalledTimes(1));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/entries/e2/merge");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      direction: "prev",
      keep: "other",
    });
    // 成功后 popover 关闭
    await waitFor(() =>
      expect(screen.queryByText("Edit entry")).toBeNull(),
    );
  });

  it("合并失败（409）：对话框仍开、显示错误，可重试", async () => {
    const fetchFn = vi.fn(
      (_path: string, _init: RequestInit) =>
        jsonResponse(
          { error: { code: "CONFLICT", message: "条目不相邻" } },
          409,
        ),
    );
    vi.stubGlobal("fetch", fetchFn);
    const onEntryUpdated = renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
        makeEntry({
          id: "e2",
          description: "Entry-e2",
          startedAt: "2025-01-06T04:00:00.000Z",
          stoppedAt: "2025-01-06T05:00:00.000Z",
        }),
      ]),
    });
    await openEditor("e2");
    const user = setupUser();
    await user.click(
      screen.getByRole("button", { name: "Merge with previous" }),
    );
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    // 对话框仍开、错误内联展示
    expect(screen.getByText("Merge entries")).toBeInTheDocument();
    expect(screen.getByText("条目不相邻")).toBeInTheDocument();
    expect(onEntryUpdated).not.toHaveBeenCalled();
    // 重试（第二次仍失败）
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  });

  it("视图内无前驱时「与上一条合并」禁用；boundary.prevEntry 可补充跨天候选", async () => {
    const fetchFn = vi.fn(
      (_path: string, _init: RequestInit) => jsonResponse({ entry: {} }),
    );
    vi.stubGlobal("fetch", fetchFn);
    // 视图内只有 e1（最早条），无 boundary
    renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
      ]),
    });
    await openEditor("e1");
    expect(
      screen.getByRole("button", { name: "Merge with previous" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Merge with next" }),
    ).toBeDisabled();
  });

  it("boundary 提供跨天相邻候选：prevEntry 可作为合并目标", async () => {
    const fetchFn = vi.fn(
      (_path: string, _init: RequestInit) => jsonResponse({ entry: {} }),
    );
    vi.stubGlobal("fetch", fetchFn);
    const prevEntry = makeEntry({
      id: "prev-day",
      description: "Entry-prev-day",
      startedAt: "2025-01-05T22:00:00.000Z",
      stoppedAt: "2025-01-05T23:00:00.000Z",
    });
    const onEntryUpdated = renderTimeline({
      today: makeToday([
        makeEntry({
          id: "e1",
          description: "Entry-e1",
          startedAt: "2025-01-06T02:00:00.000Z",
          stoppedAt: "2025-01-06T03:00:00.000Z",
        }),
      ]),
      boundary: { tz: "UTC", prevEntry, nextEntry: null },
    });
    await openEditor("e1");
    const mergePrev = screen.getByRole("button", {
      name: "Merge with previous",
    });
    expect(mergePrev).toBeEnabled();
    const user = setupUser();
    await user.click(mergePrev);
    // 默认 keep=self，直接确认
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(onEntryUpdated).toHaveBeenCalledTimes(1));
    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/entries/e1/merge");
    expect(JSON.parse(init.body as string)).toEqual({
      direction: "prev",
      keep: "self",
    });
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
