import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { useIsMobile } from "../hooks/use-mobile";
import { PopoverAnchor } from "./ui/popover";
import { ResponsiveEditPopover } from "./ResponsiveEditPopover";

// i18n 由 setup.ts 全局初始化并 pin 到 en；srTitle 由调用方传入字符串，组件自身不调 t()。

vi.mock("../hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));

const useIsMobileMock = vi.mocked(useIsMobile);

/** Radix Popover/Dialog Root 在 jsdom 下需要 window.matchMedia（jsdom 未提供）。 */
function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(
      (query: string) =>
        ({
          media: query,
          matches: false,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    ),
  );
}

/**
 * Radix DismissableLayer 在 mount 后用 setTimeout(0) 才把 document 级
 * pointerdown/focusin 监听挂上；render 后先等一个 macrotask 再派发事件。
 */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** radix portal 内容挂到 document.body，需手动清理（quality-guidelines.md）。 */
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  stubMatchMedia();
});

function renderContainer(
  overrides?: Partial<React.ComponentProps<typeof ResponsiveEditPopover>>,
) {
  const onOpenChange = vi.fn();
  const anchor = React.createRef<HTMLButtonElement>();
  const utils = render(
    <div>
      <button ref={anchor}>anchor-btn</button>
      <ResponsiveEditPopover
        open
        onOpenChange={onOpenChange}
        anchor={anchor}
        srTitle="Edit entry"
        {...overrides}
      >
        <p>form-content</p>
      </ResponsiveEditPopover>
    </div>,
  );
  return { onOpenChange, anchor, ...utils };
}

/** rootChildren 用例的容器：主体内渲染零尺寸 PopoverAnchor（Timeline 形态） */
function renderWithRootChildren(
  overrides?: Partial<React.ComponentProps<typeof ResponsiveEditPopover>>,
) {
  const onOpenChange = vi.fn();
  const utils = render(
    <ResponsiveEditPopover
      open={false}
      onOpenChange={onOpenChange}
      srTitle="Edit entry"
      {...overrides}
    >
      <p>form-content</p>
    </ResponsiveEditPopover>,
  );
  return { onOpenChange, ...utils };
}

describe("ResponsiveEditPopover", () => {
  it("desktop (isMobile=false) renders popover content with children when open", () => {
    useIsMobileMock.mockReturnValue(false);
    renderContainer();
    expect(screen.getByText("form-content")).toBeInTheDocument();
    // Popover 分支：渲染 data-slot=popover-content（portal 挂 body）
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).not.toBeNull();
    // Sheet 分支不应出现
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
  });

  it("desktop does not render children when closed", () => {
    useIsMobileMock.mockReturnValue(false);
    renderContainer({ open: false });
    expect(screen.queryByText("form-content")).not.toBeInTheDocument();
  });

  it("desktop renders fine without an anchor (tolerated omission)", () => {
    useIsMobileMock.mockReturnValue(false);
    const onOpenChange = vi.fn();
    render(
      <ResponsiveEditPopover open onOpenChange={onOpenChange} srTitle="Edit">
        <p>form-content</p>
      </ResponsiveEditPopover>,
    );
    expect(screen.getByText("form-content")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="popover-anchor"]')).toBeNull();
  });

  it("mobile (isMobile=true) renders bottom sheet with children and sr-only title", () => {
    useIsMobileMock.mockReturnValue(true);
    renderContainer();
    expect(screen.getByText("form-content")).toBeInTheDocument();
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).not.toBeNull();
    expect(sheetContent).not.toHaveClass("inset-y-0"); // side="bottom" 而非 right/left
    // srTitle 以 sr-only SheetTitle 满足 Radix a11y（sr-only 落在 SheetHeader 上）
    const title = screen.getByText("Edit entry");
    expect(title).toBeInTheDocument();
    expect(title.parentElement?.className).toContain("sr-only");
    // 不渲染右上角关闭按钮（表单自带取消，避免与表单冲突）
    const closeButtons = Array.from(
      sheetContent?.querySelectorAll("button") ?? [],
    ).filter((b) => !b.closest('[data-slot="sheet-header"]'));
    expect(closeButtons).toHaveLength(0);
    // Popover 分支不应出现
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });

  it("mobile does not render children when closed", () => {
    useIsMobileMock.mockReturnValue(true);
    renderContainer({ open: false });
    expect(screen.queryByText("form-content")).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
  });

  it("mobile Escape closes the sheet and calls onOpenChange(false)", async () => {
    useIsMobileMock.mockReturnValue(true);
    const { onOpenChange } = renderContainer();
    await settle();
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).not.toBeNull();
    await act(async () => {
      sheetContent?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("mobile clicking the overlay closes and calls onOpenChange(false)", async () => {
    useIsMobileMock.mockReturnValue(true);
    const { onOpenChange } = renderContainer();
    await settle();
    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).not.toBeNull();
    // Radix DismissableLayer 的 deferred 模式：pointerdown 记录，click 派发关闭
    await act(async () => {
      overlay?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      );
      overlay?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 }),
      );
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("desktop forwards onFocusOutside to PopoverContent", async () => {
    useIsMobileMock.mockReturnValue(false);
    const onFocusOutside = vi.fn();
    renderContainer({ onFocusOutside });
    await settle();
    // 弹层之外的真实元素获得焦点 → Radix 判定 focus-outside。
    // 注：jsdom 中手工 dispatchEvent(FocusEvent "focusin") 不走真实 focus 路径
    // （activeElement 不变），Radix 未触发；必须用 focus()。
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    await act(async () => {
      outside.focus();
    });
    await waitFor(() => {
      expect(onFocusOutside).toHaveBeenCalledTimes(1);
    });
  });

  describe("rootChildren（Timeline 形态：主体内含 PopoverAnchor）", () => {
    it("desktop renders rootChildren inside the Popover Root (anchor gets context, no error)", () => {
      useIsMobileMock.mockReturnValue(false);
      renderWithRootChildren({
        rootChildren: (
          <div data-testid="page-body">
            <PopoverAnchor className="h-0 w-0" />
          </div>
        ),
      });
      // rootChildren 始终渲染（不是弹层内容）
      expect(screen.getByTestId("page-body")).toBeInTheDocument();
      // closed 状态下弹层内容不渲染
      expect(screen.queryByText("form-content")).not.toBeInTheDocument();
    });

    it("mobile renders rootChildren inside an empty closed Popover Root (anchor does not throw)", () => {
      useIsMobileMock.mockReturnValue(true);
      renderWithRootChildren({
        rootChildren: (
          <div data-testid="page-body">
            <PopoverAnchor className="h-0 w-0" />
          </div>
        ),
      });
      // rootChildren 始终渲染，无 Root 的 PopoverAnchor 会抛错 —— 渲染成功即证明
      // 移动分支的空 Popover Root 提供了 context（风险 1 回滚方案生效）
      expect(screen.getByTestId("page-body")).toBeInTheDocument();
      expect(screen.queryByText("form-content")).not.toBeInTheDocument();
      expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    });
  });
});
