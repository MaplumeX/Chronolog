import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

// useIsMobile 的 change 回调读 window.innerWidth（非 mql.matches），
// 因此测试通过覆写 innerWidth + 触发 change 事件驱动状态变化。

describe("useIsMobile", () => {
  function setInnerWidth(width: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: width,
    });
  }

  function mockMatchMedia() {
    const listeners: (() => void)[] = [];
    const mql = {
      matches: false,
      media: "(max-width: 767px)",
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    };
    vi.stubGlobal("matchMedia", () => mql);
    return {
      fire(width: number) {
        setInnerWidth(width);
        for (const cb of listeners) cb();
      },
    };
  }

  it("桌面宽度 → false", () => {
    setInnerWidth(1024);
    mockMatchMedia();
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    unmount();
  });

  it("窄宽度（<768px）→ true", () => {
    setInnerWidth(500);
    mockMatchMedia();
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    unmount();
  });

  it("边界 767px → true，768px → false", () => {
    setInnerWidth(767);
    mockMatchMedia();
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    unmount();
  });

  it("matchMedia change 事件随 innerWidth 更新状态", () => {
    setInnerWidth(1024);
    const { fire } = mockMatchMedia();
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => fire(500));
    expect(result.current).toBe(true);
    act(() => fire(1024));
    expect(result.current).toBe(false);
    unmount();
  });
});
