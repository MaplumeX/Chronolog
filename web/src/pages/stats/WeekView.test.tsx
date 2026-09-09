import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RangeStats } from "../../api";
import { WeekView } from "./WeekView";

// WeekView 渲染冒烟（depth-A）：给定 RangeStats fixture（含 entries），
// 断言堆叠柱容器（recharts surface）、分类环比行（▲/—）出现。
// 不做 recharts 内部断言。ResizeObserver 由 recharts ResponsiveContainer 需要，jsdom 未提供。

vi.mock("../../api", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../api")>();
  return { ...orig, api: { statsRange: vi.fn() } };
});

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

// 周一 2025-09-08 .. 周日 2025-09-14（UTC）
const WEEK_START = "2025-09-08";

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
    durationSeconds:
      (Date.parse(stoppedAt) - Date.parse(startedAt)) / 1000,
    tags: [],
  };
}

function stats(overrides?: Partial<RangeStats>): RangeStats {
  return {
    tz: "UTC",
    rangeStart: `${WEEK_START}T00:00:00.000Z`,
    rangeEnd: "2025-09-15T00:00:00.000Z",
    days: Array.from({ length: 7 }, (_, i) => ({
      date: `2025-09-0${8 + i}`,
      seconds: 3600,
    })),
    categories: [
      { categoryId: "c1", categoryName: "Work", seconds: 12600 },
      { categoryId: "c2", categoryName: "Study", seconds: 3600 },
    ],
    tags: [],
    totalSeconds: 16200,
    entries: [
      // 周一 1h Work + 周二 2.5h Work + 1h Study
      entry("e1", "c1", "Work", "2025-09-08T01:00:00.000Z", "2025-09-08T02:00:00.000Z"),
      entry("e2", "c1", "Work", "2025-09-09T01:00:00.000Z", "2025-09-09T03:30:00.000Z"),
      entry("e3", "c2", "Study", "2025-09-09T05:00:00.000Z", "2025-09-09T06:00:00.000Z"),
    ],
    ...overrides,
  };
}

const tools = {
  categories: [
    { id: "c1", name: "Work", color: 1, parentId: null },
    { id: "c2", name: "Study", color: 2, parentId: null },
  ],
  tags: [],
  tagId: undefined,
  rollup: false,
  onRollupChange: () => {},
};

describe("WeekView 渲染冒烟", () => {
  it("渲染堆叠柱容器与分类环比行（含 ▲）", async () => {
    render(
      <WeekView
        tz="UTC"
        weekStart={WEEK_START}
        stats={stats()}
        prevStats={
          stats({
            categories: [
              { categoryId: "c1", categoryName: "Work", seconds: 9000 },
            ],
            entries: [],
          })
        }
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    // 分类名出现（图例 + 环比行各一处）
    await waitFor(() => {
      expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Study").length).toBeGreaterThan(0);
    // 环比标题 + 每日结构标题
    expect(screen.getByText("vs last week")).toBeTruthy();
    expect(screen.getByText("Daily structure")).toBeTruthy();
    // recharts surface（堆叠柱）真实渲染
    await waitFor(() => {
      expect(document.querySelector(".recharts-surface")).not.toBeNull();
    });
    // ▲ 环比符号（Work: 12600 vs 9000 = +40%）
    expect(screen.getByText("▲40%")).toBeTruthy();
    // Study 上周 0 → "—"
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("prevStats 为 null 时环比列全部 — 且列表仍显示本期分类", async () => {
    render(
      <WeekView
        tz="UTC"
        weekStart={WEEK_START}
        stats={stats()}
        prevStats={null}
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    });
    // 两行都是 —
    expect(screen.getAllByText("—").length).toBe(2);
    expect(document.querySelector(".recharts-surface")).not.toBeNull();
  });

  it("空数据（全未记录）仍渲染 7 柱视图而非空态拦截", async () => {
    render(
      <WeekView
        tz="UTC"
        weekStart={WEEK_START}
        stats={stats({
          days: Array.from({ length: 7 }, (_, i) => ({
            date: `2025-09-0${8 + i}`,
            seconds: 0,
          })),
          categories: [],
          entries: [],
          totalSeconds: 0,
        })}
        prevStats={null}
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".recharts-surface")).not.toBeNull();
    });
    // 未记录图例出现（堆叠层仍含 unlogged）
    expect(screen.getByText("Unlogged")).toBeTruthy();
    // 环比卡空态文案
    expect(screen.getByText("No time entries in this range yet")).toBeTruthy();
  });
});
