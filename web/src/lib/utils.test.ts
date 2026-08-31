import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("合并多个类名", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("条件类：falsy 值被忽略", () => {
    expect(cn("foo", false && "bar", undefined, null, "baz")).toBe("foo baz");
  });

  it("对象语法：值为 true 的键保留", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("数组语法展平", () => {
    expect(cn(["foo", ["bar"]])).toBe("foo bar");
  });

  it("tailwind-merge 冲突消解：后者覆盖前者", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("非冲突类全部保留", () => {
    expect(cn("p-2", "m-4", "flex")).toBe("p-2 m-4 flex");
  });

  it("空输入 → 空字符串", () => {
    expect(cn()).toBe("");
  });
});
