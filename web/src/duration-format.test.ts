import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DURATION_FORMAT_STORAGE_KEY,
  getDurationFormat,
  setDurationFormat,
  useDurationFormat,
} from "./duration-format";

// localStorage 由 setup.ts 在每个用例后 clear。模块单例的 `current` 是导入时
// 从 localStorage 读出的初值，preset 类用例用 vi.resetModules + 动态 import 重放。

describe("duration-format", () => {
  it("无存储时默认 letters", async () => {
    vi.resetModules();
    const mod = await import("./duration-format");
    expect(mod.getDurationFormat()).toBe("letters");
  });

  it("localStorage 预设 chinese → 初始为 chinese", async () => {
    window.localStorage.setItem(DURATION_FORMAT_STORAGE_KEY, "chinese");
    vi.resetModules();
    const mod = await import("./duration-format");
    expect(mod.getDurationFormat()).toBe("chinese");
  });

  it("localStorage 垃圾值 → 回退 letters", async () => {
    window.localStorage.setItem(DURATION_FORMAT_STORAGE_KEY, "colon");
    vi.resetModules();
    const mod = await import("./duration-format");
    expect(mod.getDurationFormat()).toBe("letters");
  });

  it("localStorage.getItem 抛异常（隐私模式）→ 默认 letters 且不炸", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
      clear: () => {},
    });
    vi.resetModules();
    const mod = await import("./duration-format");
    expect(mod.getDurationFormat()).toBe("letters");
    // setItem 抛异常：仅内存态生效，不报错
    expect(() => mod.setDurationFormat("chinese")).not.toThrow();
    expect(mod.getDurationFormat()).toBe("chinese");
    vi.unstubAllGlobals();
  });

  it("setDurationFormat 写 localStorage 并通知订阅者", () => {
    const { result } = renderHook(() => useDurationFormat());
    expect(result.current).toBe("letters");
    act(() => setDurationFormat("chinese"));
    expect(result.current).toBe("chinese");
    expect(window.localStorage.getItem(DURATION_FORMAT_STORAGE_KEY)).toBe("chinese");
    expect(getDurationFormat()).toBe("chinese");
  });
});
