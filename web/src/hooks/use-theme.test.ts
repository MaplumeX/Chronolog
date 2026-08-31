import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./use-theme";

// localStorage 由 setup.ts 在每个用例后 clear；matchMedia 需每个用例重置。

function mockMatchMedia(prefersDark: boolean) {
  const listeners = new Map<string, ((e: MediaQueryListEvent) => void)[]>();
  const mql = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (type: string, cb: EventListenerOrEventListenerObject) => {
      const list = listeners.get(type) ?? [];
      list.push(cb as (e: MediaQueryListEvent) => void);
      listeners.set(type, list);
    },
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  } as MediaQueryList;
  vi.stubGlobal("matchMedia", (query: string) => ({
    ...mql,
    media: query,
  }));
  return {
    mql,
    fireChange(matches: boolean) {
      Object.defineProperty(mql, "matches", { value: matches, configurable: true });
      for (const cb of listeners.get("change") ?? []) {
        cb({ matches } as MediaQueryListEvent);
      }
    },
  };
}

describe("useTheme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("无存储时默认 system，跟随系统亮色", () => {
    mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    unmount();
  });

  it("system 模式下系统深色 → 加 .dark", () => {
    mockMatchMedia(true);
    const { unmount } = renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    unmount();
  });

  it("localStorage 持久化 dark → 初始即 dark", () => {
    mockMatchMedia(false);
    window.localStorage.setItem("chronolog-theme", "dark");
    const { result, unmount } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    unmount();
  });

  it("localStorage 垃圾值 → 回退 system", () => {
    mockMatchMedia(false);
    window.localStorage.setItem("chronolog-theme", "neon");
    const { result, unmount } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("system");
    unmount();
  });

  it("setMode 写 localStorage 并应用", () => {
    mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useTheme());
    act(() => result.current.setMode("dark"));
    expect(window.localStorage.getItem("chronolog-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => result.current.setMode("light"));
    expect(window.localStorage.getItem("chronolog-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    unmount();
  });

  it("system 模式下响应 matchMedia change 事件", () => {
    const { fireChange } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => fireChange(true));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    unmount();
  });
});
