import { cleanup, render, screen, within } from "@testing-library/react";
import { beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "../hooks/use-mobile";
import { Shell, type PageId } from "./Shell";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。

vi.mock("../hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));

const useIsMobileMock = vi.mocked(useIsMobile);

function renderShell(page: PageId = "timer") {
  const onPage = vi.fn();
  render(
    <Shell
      username="alice"
      displayName={null}
      page={page}
      onPage={onPage}
      header={
        <h1 className="px-2 text-xl font-semibold tracking-tight">Stats</h1>
      }
    >
      <div>content</div>
    </Shell>,
  );
  return onPage;
}

/** useIsMobile / sidebar 依赖 window.matchMedia 与 ResizeObserver（jsdom 未提供），统一 stub。 */
function stubBrowserApis() {
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

afterEach(() => {
  cleanup();
});

describe("Shell 桌面端（≥768px）", () => {
  beforeEach(() => {
    stubBrowserApis();
    useIsMobileMock.mockReturnValue(false);
  });

  it("渲染 sidebar + SidebarTrigger，无移动端 Tab 栏", () => {
    renderShell("stats");
    // sidebar 容器存在（桌面 div 路径）
    expect(document.querySelector('[data-slot="sidebar"]')).not.toBeNull();
    // SidebarTrigger 与 SidebarRail 同名（都叫 Toggle sidebar），取第一个
    expect(
      screen.getAllByRole("button", { name: "Toggle sidebar" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId("mobile-tab-bar")).toBeNull();
    // 桌面设置入口仍在 sidebar 底部
    expect(
      screen.getByRole("button", { name: /^Settings$/ }),
    ).toBeInTheDocument();
  });

  it("sidebar 5 个导航项 + 底部设置项可切换页面", async () => {
    const onPage = renderShell("timer");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Goals$/ }));
    expect(onPage).toHaveBeenCalledWith("goals");
    await user.click(screen.getByRole("button", { name: /^Settings$/ }));
    expect(onPage).toHaveBeenCalledWith("settings");
  });
});

describe("Shell 移动端（<768px）", () => {
  beforeEach(() => {
    stubBrowserApis();
    useIsMobileMock.mockReturnValue(true);
  });

  it("不渲染 sidebar/抽屉，渲染底部 Tab 栏与顶栏设置入口", () => {
    renderShell("stats");
    expect(document.querySelector('[data-slot="sidebar"]')).toBeNull();
    expect(document.querySelector('[data-slot="sidebar-wrapper"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).toBeNull();
    expect(screen.getByTestId("mobile-tab-bar")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("底部 Tab 点击切换页面", async () => {
    const onPage = renderShell("timer");
    const user = userEvent.setup();
    const bar = screen.getByTestId("mobile-tab-bar");
    await user.click(within(bar).getByRole("button", { name: /categories/i }));
    expect(onPage).toHaveBeenCalledWith("categories");
  });

  it("顶栏设置按钮切换到 settings 页", async () => {
    const onPage = renderShell("timer");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(onPage).toHaveBeenCalledWith("settings");
  });
});
