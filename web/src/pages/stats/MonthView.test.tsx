import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RangeStats } from "../../api";
import { MonthView } from "./MonthView";

// MonthView 渲染冒烟（depth-A）：给定 RangeStats fixture（含 entries / days），
// 断言热力图格子（未来禁用 / 无记录描边 / 有记录着色）、KPI 值、分类环比出现。
// MonthView 不含 recharts，无需 ResizeObserver stub；i18n 固定 en。

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

// 2025 年 9 月（30 天，周一 9/1 开头，恰好无前置空位）
function stats(overrides?: Partial<RangeStats>): RangeStats {
  return {
    tz: "UTC",
    rangeStart: "2025-09-01T00:00:00.000Z",
    rangeEnd: "2025-10-01T00:00:00.000Z",
    days: Array.from({ length: 30 }, (_, i) => ({
      date: `2025-09-${String(i + 1).padStart(2, "0")}`,
      seconds: i < 20 ? 3600 : 0,
    })),
    categories: [
      { categoryId: "c1", categoryName: "Work", seconds: 54000 },
      { categoryId: "c2", categoryName: "Study", seconds: 18000 },
    ],
    tags: [],
    totalSeconds: 72000,
    entries: [
      entry("e1", "c1", "Work", "2025-09-01T01:00:00.000Z", "2025-09-01T03:00:00.000Z"),
      entry("e2", "c1", "Work", "2025-09-02T01:00:00.000Z", "2025-09-02T04:00:00.000Z"),
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

describe("MonthView 渲染冒烟", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("渲染月导航、KPI 与热力图格子（默认最大分类）", async () => {
    // 今天锚定月中（9/15）：9/16 起为未来日期
    vi.setSystemTime(new Date("2025-09-15T12:00:00.000Z"));

    render(
      <MonthView
        tz="UTC"
        monthAnchor="2025-09-15"
        stats={stats()}
        prevStats={null}
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    // 月标签 + 导航 aria-label
    expect(screen.getByText("September 2025")).toBeTruthy();
    expect(screen.getByLabelText("Previous month")).toBeTruthy();
    expect(screen.getByLabelText("Next month")).toBeTruthy();
    // 本月导航按钮：查看本月时隐藏
    expect(screen.queryByText("This month")).toBeNull();

    // KPI：记录完整度 15/15 天（前 20 天有记录，已过 15 天）
    expect(screen.getByText("15/15 days")).toBeTruthy();
    // 连续记录：前 20 天连续 → 20 天
    expect(screen.getByText("20 days")).toBeTruthy();
    // 默认选中 Work（最大分类）：月合计 15:00:00
    expect(screen.getAllByText("15:00:00").length).toBeGreaterThan(0);
    // 日均 = 54000/30 = 1800s = 0:30:00（插值整句 avg 0:30:00/day，用正则匹配）
    expect(screen.getAllByText(/0:30:00/).length).toBeGreaterThan(0);
    // prevStats null → 环比 "—"
    expect(screen.getByText("—")).toBeTruthy();

    // 热力图格子数量 = 30 天 + 尾部补位（9/30 周二 → 补 5 格 = 35）
    const grid = screen.getByText("September 2025").closest("div");
    void grid;
    const cellCount = document.querySelectorAll(".aspect-square").length;
    expect(cellCount).toBe(35);

    // 未来日期禁用（aria-disabled）
    expect(document.querySelectorAll("[aria-disabled='true']").length).toBe(15);
    // 无记录描边空格（9/21..9/30 中已过的 9/21..9/15 → 已过到 9/15，9/16 起是未来；
    // 无记录且非未来 = 无（前 20 天都有记录，9/16+ 全是未来）→ 断言 0）
    const dashed = document.querySelectorAll(".border-dashed").length;
    expect(dashed).toBe(0);
  });

  it("无记录的已过日期渲染描边空格，环比 ▲ 显示", async () => {
    // 今天锚定月末之后查看整月（全部已过，9/1..9/30）
    vi.setSystemTime(new Date("2025-10-05T12:00:00.000Z"));

    render(
      <MonthView
        tz="UTC"
        monthAnchor="2025-09-10"
        stats={stats()}
        prevStats={stats({
          categories: [
            { categoryId: "c1", categoryName: "Work", seconds: 27000 },
          ],
          entries: [],
        })}
        tools={tools}
        onNavigate={() => {}}
      />,
    );

    // 上月导航按钮出现（非本月）
    expect(screen.getByText("This month")).toBeTruthy();
    // 记录完整度 20/30 天
    expect(screen.getByText("20/30 days")).toBeTruthy();
    // 无记录已过日（9/21..9/30）= 10 个描边空格
    expect(document.querySelectorAll(".border-dashed").length).toBe(10);
    // 未来日期无
    expect(document.querySelectorAll("[aria-disabled='true']").length).toBe(0);
    // Work 环比：54000 vs 27000 = +100%
    expect(screen.getByText("▲100%")).toBeTruthy();
  });

  it("空月（无分类无条目）正常渲染，不拦截", async () => {
    vi.setSystemTime(new Date("2025-09-15T12:00:00.000Z"));

    render(
      <MonthView
        tz="UTC"
        monthAnchor="2025-09-15"
        stats={stats({
          days: Array.from({ length: 30 }, (_, i) => ({
            date: `2025-09-${String(i + 1).padStart(2, "0")}`,
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

    // 完整度 0/15
    expect(screen.getByText("0/15 days")).toBeTruthy();
    // 连续 0 天
    expect(screen.getByText("0 days")).toBeTruthy();
    // 热力图格子仍渲染（30 + 5 补位）
    expect(document.querySelectorAll(".aspect-square").length).toBe(35);
    // 分类选择器禁用态文案
    expect(screen.getByText("No categories")).toBeTruthy();
    // 已过无记录日 = 15 个描边空格
    expect(document.querySelectorAll(".border-dashed").length).toBe(15);
    await waitFor(() => {
      expect(screen.getByText("September 2025")).toBeTruthy();
    });
  });

  it("月导航回调上一月/下一月", () => {
    vi.setSystemTime(new Date("2025-09-15T12:00:00.000Z"));
    const onNavigate = vi.fn();

    render(
      <MonthView
        tz="UTC"
        monthAnchor="2025-09-15"
        stats={stats()}
        prevStats={null}
        tools={tools}
        onNavigate={onNavigate}
      />,
    );

    screen.getByLabelText("Previous month").click();
    expect(onNavigate).toHaveBeenLastCalledWith("2025-08-31");
    screen.getByLabelText("Next month").click();
    expect(onNavigate).toHaveBeenLastCalledWith("2025-10-01");
  });
});
