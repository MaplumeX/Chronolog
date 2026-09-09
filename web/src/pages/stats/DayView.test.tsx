import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { DayView } from "./DayView";

// DayView 渲染冒烟（depth-A）：给定 /api/entries/today fixture，
// 断言环形图容器（recharts surface）、分类构成行、未记录行出现。
// 不做 recharts 内部断言。ResizeObserver 由 recharts ResponsiveContainer 需要，jsdom 未提供。

vi.mock("../../api", () => ({
  ApiError: class extends Error {},
  api: { todayEntries: vi.fn() },
}));

const apiMock = vi.mocked(api);

beforeEach(() => {
  // recharts ResponsiveContainer 依赖 ResizeObserver + getBoundingClientRect 布局尺寸，
  // jsdom 两者皆无：stub RO，并把容器测量补成固定 300×200（仅本文件内恢复）。
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const orig = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    return { ...orig.call(this), width: 300, height: 200 };
  };
  restoreGBCR = () => {
    Element.prototype.getBoundingClientRect = orig;
  };
});

let restoreGBCR: () => void = () => {};

afterEach(() => {
  restoreGBCR();
  cleanup();
  vi.clearAllMocks();
});

const DAY = "2025-09-09";

function fixture() {
  return {
    tz: "UTC",
    dayStart: `${DAY}T00:00:00.000Z`,
    dayEnd: `${DAY}T12:00:00.000Z`,
    entries: [
      {
        id: "e1",
        categoryId: "c1",
        categoryName: "Work",
        description: "",
        startedAt: `${DAY}T01:00:00.000Z`,
        stoppedAt: `${DAY}T02:30:00.000Z`,
        durationSeconds: 5400,
        tags: [],
      },
    ],
    totalClippedSeconds: 5400,
  };
}

const tools = {
  categories: [{ id: "c1", name: "Work", color: 1, parentId: null }],
  tags: [],
  tagId: undefined,
  rollup: false,
  onRollupChange: () => {},
};

describe("DayView 渲染冒烟", () => {
  it("渲染环形图容器与分类构成行 + 未记录行", async () => {
    apiMock.todayEntries.mockResolvedValue(fixture() as never);
    render(
      <DayView
        tz="UTC"
        date={DAY}
        isToday={false}
        stats={null}
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    // 分类构成行
    await waitFor(() => {
      expect(screen.getByText("Work")).toBeTruthy();
    });
    // 未记录灰桶行
    expect(screen.getByText("Unlogged")).toBeTruthy();
    // recharts surface（环形图）真实渲染
    await waitFor(() => {
      expect(document.querySelector(".recharts-surface")).not.toBeNull();
    });
    // 覆盖度中心覆盖层文案
    expect(screen.getByText("Coverage")).toBeTruthy();
  });

  it("空数据（全未记录）仍渲染构成视图而非空态拦截", async () => {
    apiMock.todayEntries.mockResolvedValue({
      ...fixture(),
      entries: [],
      totalClippedSeconds: 0,
    } as never);
    render(
      <DayView
        tz="UTC"
        date={DAY}
        isToday={false}
        stats={null}
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Unlogged")).toBeTruthy();
    });
    expect(screen.queryByText("24:00")).toBeNull();
  });
});
