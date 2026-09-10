import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { RangeStats } from "../../api";
import { CustomView } from "./CustomView";

// CustomView 渲染冒烟（depth-A）：给定 RangeStats fixture（含 entries），
// 断言堆叠柱容器（recharts surface）、分类构成行（含未记录行）、标签分布行出现；
// 未选区间时显示占位提示。不做 recharts 内部断言。

beforeEach(() => {
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

function entry(
  id: string,
  categoryId: string | null,
  categoryName: string,
  startedAt: string,
  stoppedAt: string,
) {
  return {
    id,
    categoryId,
    categoryName,
    description: "",
    startedAt,
    stoppedAt,
    durationSeconds: (Date.parse(stoppedAt) - Date.parse(startedAt)) / 1000,
    tags: [],
  };
}

// 2025-09-01 .. 2025-09-07（7 天，UTC）
function stats(overrides?: Partial<RangeStats>): RangeStats {
  return {
    tz: "UTC",
    rangeStart: "2025-09-01T00:00:00.000Z",
    rangeEnd: "2025-09-08T00:00:00.000Z",
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2025-09-0${1 + i}`,
      seconds: 3600,
    })),
    categories: [
      { categoryId: "c1", categoryName: "Work", seconds: 12600 },
      { categoryId: "c2", categoryName: "Study", seconds: 3600 },
    ],
    tags: [
      { tagId: "t1", tagName: "deep", seconds: 7200 },
      { tagId: null, tagName: null, seconds: 9000 },
    ],
    totalSeconds: 16200,
    entries: [
      entry("e1", "c1", "Work", "2025-09-01T01:00:00.000Z", "2025-09-01T02:00:00.000Z"),
      entry("e2", "c1", "Work", "2025-09-02T01:00:00.000Z", "2025-09-02T03:30:00.000Z"),
      entry("e3", "c2", "Study", "2025-09-03T05:00:00.000Z", "2025-09-03T06:00:00.000Z"),
    ],
    ...overrides,
  };
}

const tools = {
  categories: [
    { id: "c1", name: "Work", color: 1, parentId: null },
    { id: "c2", name: "Study", color: 2, parentId: null },
  ],
  tags: [{ id: "t1", color: 1 }],
  tagId: undefined,
  rollup: false,
  onRollupChange: () => {},
};

describe("CustomView 渲染冒烟", () => {
  it("渲染区间选择器 + 堆叠柱 + 分类构成（含未记录）+ 标签分布", async () => {
    render(
      <CustomView
        tz="UTC"
        from="2025-09-01"
        to="2025-09-07"
        stats={stats()}
        tools={tools}
        onRangeChange={() => {}}
      />,
    );

    // 区间摘要按钮（Sep 1 – Sep 7）
    expect(screen.getByRole("button", { name: /Sep 1 – Sep 7/ })).toBeTruthy();
    // 天数摘要
    expect(screen.getByText("7 days")).toBeTruthy();
    // recharts surface（堆叠柱）真实渲染
    await waitFor(() => {
      expect(document.querySelector(".recharts-surface")).not.toBeNull();
    });
    // 分类构成行 + 未记录行
    expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Study").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unlogged").length).toBeGreaterThan(0);
    // 标签分布：具名标签 + 无标签桶（合计不显示）
    expect(screen.getByText("deep")).toBeTruthy();
    expect(screen.getByText("No tag")).toBeTruthy();
  });

  it("空数据（区间有效但无记录）仍全灰渲染而非空态拦截", async () => {
    render(
      <CustomView
        tz="UTC"
        from="2025-09-01"
        to="2025-09-07"
        stats={stats({
          days: Array.from({ length: 7 }, (_, i) => ({
            date: `2025-09-0${1 + i}`,
            seconds: 0,
          })),
          categories: [],
          tags: [],
          entries: [],
          totalSeconds: 0,
        })}
        tools={tools}
        onRangeChange={() => {}}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-surface")).not.toBeNull();
    });
    // 未记录图例 + 未记录行（区间 7×24h 全未记录）
    expect(screen.getAllByText("Unlogged").length).toBeGreaterThan(0);
    expect(screen.getByText("168h")).toBeTruthy();
  });

  it("未选区间时显示选择提示占位卡", () => {
    render(
      <CustomView
        tz="UTC"
        from=""
        to=""
        stats={null}
        tools={tools}
        onRangeChange={() => {}}
      />,
    );

    expect(
      screen.getByText("Pick a date range to start analyzing"),
    ).toBeTruthy();
  });

  it("日历补全区间后回调 onRangeChange", async () => {
    const user = userEvent.setup({
      pointerEventsCheck: 0,
    });
    const onRangeChange = vi.fn();
    // from 已选、to 未选（incomplete 态）：选择器常驻可补全
    render(
      <CustomView
        tz="UTC"
        from="2025-09-08"
        to=""
        stats={null}
        tools={tools}
        onRangeChange={onRangeChange}
      />,
    );

    // 打开区间选择器（未选全时按钮文案 = Select date range；defaultMonth 锚在 from）
    await user.click(screen.getByRole("button", { name: "Select date range" }));
    // react-day-picker：day td 带 role=gridcell，DayButton 内文本 = 日号
    const day10 = screen.getAllByText("10").find((el) =>
      el.closest('td[data-day]'),
    );
    expect(day10).toBeTruthy();
    await user.click(day10!);
    expect(onRangeChange).toHaveBeenCalledWith("2025-09-08", "2025-09-10");
  });
});
