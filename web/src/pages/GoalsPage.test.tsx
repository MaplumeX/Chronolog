import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { GoalsPage } from "./GoalsPage";

// GoalsPage 窄屏适配回归：横向滚动由 ui/table 自带的 data-slot=table-container
// （relative w-full overflow-x-auto）内层容器承担，外层 Card 保持 overflow-hidden
// 维持 table-in-card 的圆角裁切。数据加载全部 stub，聚焦容器行为。

vi.mock("../api", () => ({
  ApiError: class extends Error {},
  api: {
    goals: vi.fn(),
    categories: vi.fn(),
    tags: vi.fn(),
  },
}));

const apiMock = vi.mocked(api);

beforeEach(() => {
  apiMock.goals.mockResolvedValue({
    goals: [
      {
        id: "g1",
        name: "Deep work",
        icon: "🎯",
        categoryId: null,
        tagId: null,
        direction: "gt",
        hours: 2,
        periodUnit: "day",
        dueDate: null,
        status: "active",
        createdAt: "2025-09-01T00:00:00Z",
        progress: { currentSeconds: 3600, targetSeconds: 7200 },
      },
    ],
  });
  apiMock.categories.mockResolvedValue({ categories: [] });
  apiMock.tags.mockResolvedValue({ tags: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GoalsPage 窄屏适配", () => {
  it("表格横向滚动由内层 table-container 承担，外层 Card 保留圆角裁切", async () => {
    render(<GoalsPage tz="UTC" />);
    await waitFor(() => {
      expect(screen.getByText("Deep work")).toBeInTheDocument();
    });
    // ui/table 自带 overflow-x-auto 内层容器（窄屏表格横向可滚）
    const tableContainer = document.querySelector(
      "[data-slot='table-container']",
    );
    expect(tableContainer).not.toBeNull();
    expect(tableContainer!.className).toContain("overflow-x-auto");
    // 外层 Card 保持 overflow-hidden（table-in-card 圆角裁切，spec 约定）
    const card = tableContainer!.closest("[data-slot='card']");
    expect(card).not.toBeNull();
    expect(card!.className).toContain("overflow-hidden");
  });
});
