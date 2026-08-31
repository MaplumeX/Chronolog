import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimeEntry, TodayEntries } from "../api";
import { useTimerController } from "./use-timer-controller";

// i18n 由 setup.ts 全局初始化并固定为 en，本文件无需额外 Provider。
// localStorage 由 setup.ts 在每个用例后 clear；本文件用例均在 renderHook 前预设。

const DATE_VIEW_KEY = "chronolog-date-view";

const TODAY_FIXTURE: TodayEntries = {
  tz: "UTC",
  dayStart: "2025-01-01T00:00:00.000Z",
  dayEnd: "2025-01-02T00:00:00.000Z",
  entries: [],
  totalClippedSeconds: 0,
};

/** refresh() 所需的全部接口最小响应。 */
function stubRefreshFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    let body: unknown = {};
    if (path.startsWith("/api/categories")) body = { categories: [] };
    else if (path.startsWith("/api/tags")) body = { tags: [] };
    else if (path.startsWith("/api/timer/current")) body = { entry: null };
    else if (path.startsWith("/api/entries/today")) body = TODAY_FIXTURE;
    else if (path.startsWith("/api/entries/boundary")) body = { before: null, after: null };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
}

function renderController(overrides?: Partial<Parameters<typeof useTimerController>[0]>) {
  return renderHook(
    (props: Parameters<typeof useTimerController>[0]) => useTimerController(props),
    {
      initialProps: {
        nowMs: Date.now(),
        current: null as TimeEntry | null,
        onCurrent: () => {},
        enabled: false,
        ...overrides,
      },
    },
  );
}

describe("loadDateView 初始状态", () => {
  it("localStorage 预设合法 YYYY-MM-DD → 初始 date 为该值", () => {
    window.localStorage.setItem(DATE_VIEW_KEY, "2025-01-15");
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.date).toBe("2025-01-15");
    unmount();
  });

  it("localStorage 预设垃圾值 → 初始 date 为 null（今天）", () => {
    window.localStorage.setItem(DATE_VIEW_KEY, "not-a-date");
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.date).toBeNull();
    unmount();
  });

  it("localStorage 预设空串 → 初始 date 为 null", () => {
    window.localStorage.setItem(DATE_VIEW_KEY, "");
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.date).toBeNull();
    unmount();
  });

  it("未预设任何值 → 初始 date 为 null", () => {
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.date).toBeNull();
    unmount();
  });

  it("localStorage.getItem 抛异常（隐私模式）→ 初始 date 为 null 且不炸", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.date).toBeNull();
    unmount();
  });
});

describe("enabled 门控", () => {
  it("enabled: false 时不发起任何 fetch", () => {
    const fetchSpy = stubRefreshFetch();
    vi.stubGlobal("fetch", fetchSpy);
    const { unmount } = renderController({ enabled: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("enabled: true 时发起 refresh 数据请求", async () => {
    const fetchSpy = stubRefreshFetch();
    vi.stubGlobal("fetch", fetchSpy);
    const { unmount } = renderController({ enabled: true });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const paths = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.startsWith("/api/categories"))).toBe(true);
    expect(paths.some((p) => p.startsWith("/api/tags"))).toBe(true);
    expect(paths.some((p) => p.startsWith("/api/timer/current"))).toBe(true);
    expect(paths.some((p) => p.startsWith("/api/entries/today"))).toBe(true);
    unmount();
  });

  it("enabled: false → true（rerender）后才开始拉取", async () => {
    const fetchSpy = stubRefreshFetch();
    vi.stubGlobal("fetch", fetchSpy);
    const { rerender, unmount } = renderController({ enabled: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    rerender({
      nowMs: Date.now(),
      current: null,
      onCurrent: () => {},
      enabled: true,
    });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    unmount();
  });
});
