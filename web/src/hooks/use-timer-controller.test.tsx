import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import assert from "node:assert/strict";
import type { TimeEntry, TodayEntries } from "../api";
import { useTimerController } from "./use-timer-controller";

// i18n 由 setup.ts 全局初始化并固定为 en，本文件无需额外 Provider。
// localStorage 由 setup.ts 在每个用例后 clear；本文件用例均在 renderHook 前预设。

const DATE_VIEW_KEY = "chronolog-date-view";
const VIEW_MODE_KEY = "chronolog-view-mode";

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
        tz: "UTC",
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
      tz: "UTC",
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

  it("tz 变化（rerender）后重新拉取 today 数据", async () => {
    const fetchSpy = stubRefreshFetch();
    vi.stubGlobal("fetch", fetchSpy);
    const { rerender, unmount } = renderController({ enabled: true });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    fetchSpy.mockClear();
    // 切换时区 → refresh effect 重跑
    rerender({
      tz: "America/New_York",
      nowMs: Date.now(),
      current: null,
      onCurrent: () => {},
      enabled: true,
    });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const paths = fetchSpy.mock.calls.map((c) => String(c[0]));
    const todayPath = paths.find((p) => p.startsWith("/api/entries/today"));
    expect(todayPath).toContain(encodeURIComponent("America/New_York"));
    unmount();
  });
});

describe("loadViewMode 初始状态", () => {
  it("localStorage 预设 week → 初始 view 为 week", () => {
    window.localStorage.setItem(VIEW_MODE_KEY, "week");
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.mode).toBe("week");
    unmount();
  });

  it("localStorage 预设 day → 初始 view 为 day", () => {
    window.localStorage.setItem(VIEW_MODE_KEY, "day");
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.mode).toBe("day");
    unmount();
  });

  it("localStorage 预设垃圾值 → 初始 view 回退 day", () => {
    window.localStorage.setItem(VIEW_MODE_KEY, "month");
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.mode).toBe("day");
    unmount();
  });

  it("未预设任何值 → 初始 view 为 day", () => {
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.mode).toBe("day");
    unmount();
  });

  it("localStorage.getItem 抛异常（隐私模式）→ 初始 view 为 day 且不炸", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const { result, unmount } = renderController();
    expect(result.current.timelineProps.mode).toBe("day");
    unmount();
  });
});

describe("view 模式切换持久化", () => {
  const WEEK_FIXTURE = {
    tz: "UTC",
    weekStart: "2025-01-06T00:00:00.000Z",
    weekEnd: "2025-01-13T00:00:00.000Z",
    days: Array.from({ length: 7 }, (_, i) => ({
      tz: "UTC",
      dayStart: `2025-01-0${6 + i}T00:00:00.000Z`,
      dayEnd: `2025-01-0${7 + i}T00:00:00.000Z`,
      entries: [],
      totalClippedSeconds: 0,
    })),
  };

  /** refresh + week 视图切换所需的接口响应（按请求路径分派）。 */
  function stubModeChangeFetch() {
    return vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      let body: unknown = {};
      if (path.startsWith("/api/categories")) body = { categories: [] };
      else if (path.startsWith("/api/tags")) body = { tags: [] };
      else if (path.startsWith("/api/timer/current")) body = { entry: null };
      else if (path.startsWith("/api/entries/today")) body = TODAY_FIXTURE;
      else if (path.startsWith("/api/entries/week")) body = WEEK_FIXTURE;
      else if (path.startsWith("/api/entries/boundary")) body = { before: null, after: null };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  }

  it("onModeChange 切到 week 后写入 localStorage，切回 day 同理；date 持久化不受影响", async () => {
    const fetchSpy = stubModeChangeFetch();
    vi.stubGlobal("fetch", fetchSpy);
    window.localStorage.setItem(DATE_VIEW_KEY, "2025-01-10");
    const { result, unmount } = renderController({ enabled: false });
    expect(result.current.timelineProps.mode).toBe("day");
    await act(async () => {
      await result.current.timelineProps.onModeChange("week");
    });
    expect(result.current.timelineProps.mode).toBe("week");
    expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe("week");
    // date 持久化独立存在，不被 view 写入影响
    expect(window.localStorage.getItem(DATE_VIEW_KEY)).toBe("2025-01-10");
    await act(async () => {
      await result.current.timelineProps.onModeChange("day");
    });
    expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe("day");
    // 切 week 拉取了周数据（按当前 date）
    const paths = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.startsWith("/api/entries/week"))).toBe(true);
    unmount();
  });

  it("localStorage.setItem 抛异常（隐私模式）→ 仅内存态生效，不报错", async () => {
    const fetchSpy = stubModeChangeFetch();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const { result, unmount } = renderController({ enabled: false });
    await act(async () => {
      await result.current.timelineProps.onModeChange("week");
    });
    expect(result.current.timelineProps.mode).toBe("week");
    unmount();
  });
});

const RUNNING_ENTRY: TimeEntry = {
  id: "entry-old",
  categoryId: "cat-1",
  categoryName: "Work",
  description: "seg one",
  startedAt: "2025-01-01T00:00:00.000Z",
  stoppedAt: null,
  durationSeconds: 60,
  tags: [],
};

const NEXT_ENTRY: TimeEntry = {
  id: "entry-new",
  categoryId: null,
  categoryName: "未分类",
  description: "",
  startedAt: "2025-01-01T01:00:00.000Z",
  stoppedAt: null,
  durationSeconds: 0,
  tags: [],
};

const STOPPED_ENTRY: TimeEntry = {
  ...RUNNING_ENTRY,
  stoppedAt: "2025-01-01T01:00:00.000Z",
};

/** stop + 后续刷新所需的接口响应（按请求路径分派）。 */
function stubToggleFetch(opts: { stopEntry: TimeEntry }) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    let body: unknown = {};
    if (path.startsWith("/api/timer/stop")) {
      assert.equal(init?.method, "POST");
      body = { entry: opts.stopEntry };
    } else if (path.startsWith("/api/categories")) body = { categories: [] };
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

describe("onToggle 停止分支（无间隙计时，task 09-08）", () => {
  it("普通模式：stop 返回已停止段 → onCurrent(null)，分类选择器不自动打开", async () => {
    const fetchSpy = stubToggleFetch({ stopEntry: STOPPED_ENTRY });
    vi.stubGlobal("fetch", fetchSpy);
    const onCurrent = vi.fn();
    const { result, unmount } = renderController({
      enabled: false,
      current: RUNNING_ENTRY,
      onCurrent,
    });
    expect(result.current.barProps.error).toBe("");
    await act(async () => {
      await result.current.barProps.onToggle();
    });
    expect(onCurrent).toHaveBeenCalledWith(null);
    // 完全停止：分类选择器不自动打开（open 为 undefined = 非受控），引导信号亦为 false
    expect(result.current.barProps.categoryPicker).toBeDefined();
    expect(result.current.barProps.categoryPicker.props.open).toBeUndefined();
    expect(result.current.barProps.autoOpenEditor).toBe(false);
    unmount();
  });

  it("无间隙模式：stop 返回新段（stoppedAt null）→ onCurrent(新段) 且选择器标记自动打开", async () => {
    const fetchSpy = stubToggleFetch({ stopEntry: NEXT_ENTRY });
    vi.stubGlobal("fetch", fetchSpy);
    const onCurrent = vi.fn();
    const { result, rerender, unmount } = renderController({
      enabled: false,
      current: RUNNING_ENTRY,
      onCurrent,
    });
    expect(result.current.barProps.categoryPicker).toBeDefined();
    await act(async () => {
      await result.current.barProps.onToggle();
    });
    // 换段成功：全局 current 替换为新段，且分类选择器受控自动打开（AC5）
    expect(onCurrent).toHaveBeenCalledTimes(1);
    expect(onCurrent).toHaveBeenCalledWith(NEXT_ENTRY);
    expect(result.current.barProps.categoryPicker.props.open).toBe(true);
    // barProps 暴露引导信号：移动端停靠胶囊据此自动展开编辑 sheet
    expect(result.current.barProps.autoOpenEditor).toBe(true);
    // 选完分类：onChange 内复位信号 → autoOpenEditor 变 false（sheet 派生关闭）
    rerender({
      tz: "UTC",
      nowMs: Date.now(),
      current: NEXT_ENTRY,
      onCurrent,
      enabled: false,
    });
    await act(async () => {
      result.current.barProps.categoryPicker.props.onChange("cat-9");
    });
    expect(result.current.barProps.autoOpenEditor).toBe(false);
    // onAutoOpenConsumed（用户未选分类直接关 sheet）同样复位
    await act(async () => {
      result.current.barProps.onAutoOpenConsumed();
    });
    expect(result.current.barProps.autoOpenEditor).toBe(false);
    // 刷新 today 数据
    const paths = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.startsWith("/api/entries/today"))).toBe(true);
    unmount();
  });

  it("stop 409（无运行计时）→ 错误展示，onCurrent 不被调用", async () => {
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      let body: unknown = { error: { code: "CONFLICT", message: "当前没有正在运行的计时" } };
      let status = 409;
      if (path.startsWith("/api/categories")) {
        body = { categories: [] };
        status = 200;
      } else if (path.startsWith("/api/entries/today")) {
        body = TODAY_FIXTURE;
        status = 200;
      }
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchSpy);
    const onCurrent = vi.fn();
    const { result, unmount } = renderController({
      enabled: false,
      current: RUNNING_ENTRY,
      onCurrent,
    });
    await act(async () => {
      await result.current.barProps.onToggle();
    });
    expect(onCurrent).not.toHaveBeenCalled();
    expect(result.current.barProps.error).not.toBe("");
    expect(result.current.barProps.categoryPicker.props.open).toBeUndefined();
    expect(result.current.barProps.autoOpenEditor).toBe(false);
    unmount();
  });
});
