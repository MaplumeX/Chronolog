import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./MobileTabBar";
import type { PageId } from "./nav-items";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。

function renderBar(page: PageId = "timer") {
  const onPage = vi.fn();
  render(<MobileTabBar page={page} onPage={onPage} />);
  return onPage;
}

afterEach(() => {
  cleanup();
});

describe("MobileTabBar", () => {
  it("渲染 5 个主导航 Tab", () => {
    renderBar();
    const nav = screen.getByRole("navigation", { name: "Navigation" });
    const tabs = within(nav).getAllByRole("button");
    expect(tabs.map((x) => x.textContent)).toEqual([
      "Timer",
      "Stats",
      "Goals",
      "Categories",
      "Tags",
    ]);
  });

  it("激活 Tab 带 aria-current 且命中区 ≥40px 高", () => {
    renderBar("stats");
    const stats = screen.getByRole("button", { name: /stats/i });
    expect(stats).toHaveAttribute("aria-current", "page");
    expect(stats).toHaveClass("text-primary", "min-h-[48px]");
    // 非激活 Tab 无 aria-current
    expect(screen.getByRole("button", { name: /timer/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("点击 Tab 调用 onPage 并传对应 PageId", async () => {
    const onPage = renderBar("timer");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /goals/i }));
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onPage).toHaveBeenCalledWith("goals");
  });

  it("不含设置页（设置走移动端顶栏入口）", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: /settings/i })).toBeNull();
  });
});
