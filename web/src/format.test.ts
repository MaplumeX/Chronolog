import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserTz,
  clipSeconds,
  elapsedSeconds,
  formatClock,
  formatDayLabel,
  formatDuration,
  formatEntryTimeRange,
  formatWeekLabel,
  formatWeekdayHeader,
  paletteColor,
  paletteForegroundColor,
} from "./format";

// setup.ts 已将 i18n 固定为 en（localeFor("en") → "en"）。

afterEach(() => {
  // setup.ts 不恢复 fake timers，本文件自行恢复。
  vi.useRealTimers();
});

describe("formatDuration", () => {
  it("0 → 0:00:00", () => {
    expect(formatDuration(0)).toBe("0:00:00");
  });

  it("秒/分/时各段补零", () => {
    expect(formatDuration(5)).toBe("0:00:05");
    expect(formatDuration(65)).toBe("0:01:05");
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("进位：59→60 秒进位到分，59:59→1:00:00", () => {
    expect(formatDuration(59)).toBe("0:00:59");
    expect(formatDuration(60)).toBe("0:01:00");
    expect(formatDuration(3599)).toBe("0:59:59");
  });

  it("大小时数不截断", () => {
    expect(formatDuration(100 * 3600)).toBe("100:00:00");
  });

  it("负数钳制为 0", () => {
    expect(formatDuration(-1)).toBe("0:00:00");
    expect(formatDuration(-9999)).toBe("0:00:00");
  });

  it("小数向下取整", () => {
    expect(formatDuration(1.9)).toBe("0:00:01");
    expect(formatDuration(59.999)).toBe("0:00:59");
  });
});

describe("formatClock", () => {
  it("UTC 瞬时按 tz 渲染 24 小时制（Asia/Shanghai）", () => {
    // 2025-07-15T16:00:00Z = 北京 7/16 00:00
    expect(formatClock("2025-07-15T16:00:00Z", "Asia/Shanghai")).toBe("00:00");
  });

  it("夏令时生效的 tz（America/New_York 三月 EDT = UTC-4）", () => {
    expect(formatClock("2025-03-10T03:30:00Z", "America/New_York")).toBe("23:30");
  });

  it("同一瞬时在 UTC 与上海不同时钟读数", () => {
    const iso = "2025-07-15T16:00:00Z";
    expect(formatClock(iso, "UTC")).toBe("16:00");
    expect(formatClock(iso, "Asia/Shanghai")).toBe("00:00");
  });
});

describe("formatWeekLabel", () => {
  it("普通周：weekEnd 取前一刻作为结束日", () => {
    // 周一 2025-08-25 ～ 周日 2025-08-31（Asia/Shanghai）
    expect(formatWeekLabel("2025-08-24T16:00:00Z", "2025-08-31T16:00:00Z", "Asia/Shanghai")).toBe(
      "August 25 – August 31",
    );
  });

  it("DST 回拨周：weekStart+6*24h 落在周日 23:00，end-1ms 仍取到周日", () => {
    // Europe/Berlin 2025-10-26 03:00 回拨到 02:00（25h 的一天）。
    // weekStart = 10/20 00:00 CEST，weekEnd = 10/27 00:00 CET。
    expect(formatWeekLabel("2025-10-19T22:00:00Z", "2025-10-26T23:00:00Z", "Europe/Berlin")).toBe(
      "October 20 – October 26",
    );
  });

  it("跨年周：起止横跨 12 月与 1 月", () => {
    // 北京 2025-12-29(一) ～ 2026-01-04(日)
    expect(formatWeekLabel("2025-12-28T16:00:00Z", "2026-01-04T16:00:00Z", "Asia/Shanghai")).toBe(
      "December 29 – January 4",
    );
  });
});

describe("formatDayLabel", () => {
  it("依赖 new Date()：fake timers 固定系统时间后输出「Today · <星期, 月 日>」", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-11-20T10:00:00Z"));
    // 2025-11-20 是周四（UTC 与上海同为 11/20）。
    expect(formatDayLabel("Asia/Shanghai")).toBe("Today · Thursday, November 20");
    expect(formatDayLabel("UTC")).toBe("Today · Thursday, November 20");
  });

  it("同一 UTC 瞬时在日界线两侧 tz 标签不同", () => {
    vi.useFakeTimers();
    // UTC 2025-11-20 23:30：上海已是 11/21（周五），夏威夷仍是 11/20（周四）。
    vi.setSystemTime(new Date("2025-11-20T23:30:00Z"));
    expect(formatDayLabel("Asia/Shanghai")).toBe("Today · Friday, November 21");
    expect(formatDayLabel("Pacific/Honolulu")).toBe("Today · Thursday, November 20");
  });
});

describe("formatWeekdayHeader", () => {
  it("返回日期数字与长星期文案（en）", () => {
    // 北京 2025-11-20 00:00（周四）
    expect(formatWeekdayHeader("2025-11-19T16:00:00Z", "Asia/Shanghai")).toEqual({
      day: "20",
      weekday: "Thursday",
    });
  });
});

describe("formatEntryTimeRange", () => {
  const tz = "Asia/Shanghai";

  it("非跨天条目：HH:MM – HH:MM", () => {
    // 北京 09:00 – 10:30
    expect(
      formatEntryTimeRange("2025-11-20T01:00:00Z", "2025-11-20T02:30:00Z", tz, 0),
    ).toBe("09:00 – 10:30");
  });

  it("跨天条目：两端带 MM-DD 完整日期", () => {
    // 北京 23:00 → 次日 01:00
    expect(
      formatEntryTimeRange("2025-11-20T15:00:00Z", "2025-11-20T17:00:00Z", tz, 0),
    ).toBe("11-20 23:00 – 11-21 01:00");
  });

  it("运行中条目：右端为 …（未跨天时左端纯时钟）", () => {
    const nowMs = Date.parse("2025-11-20T02:00:00Z"); // 北京 10:00
    expect(formatEntryTimeRange("2025-11-20T01:00:00Z", null, tz, nowMs)).toBe("09:00 – …");
  });

  it("运行中且已跨天：左端带日期，右端 …", () => {
    const nowMs = Date.parse("2025-11-21T01:00:00Z"); // 北京 11/21 09:00
    expect(formatEntryTimeRange("2025-11-20T15:00:00Z", null, tz, nowMs)).toBe("11-20 23:00 – …");
  });
});

describe("elapsedSeconds", () => {
  it("正常差值向下取整", () => {
    const startedAt = "2025-11-20T00:00:00Z";
    expect(elapsedSeconds(startedAt, Date.parse(startedAt) + 61_500)).toBe(61);
  });

  it("nowMs 早于 startedAt → 钳制为 0", () => {
    const startedAt = "2025-11-20T00:00:00Z";
    expect(elapsedSeconds(startedAt, Date.parse(startedAt) - 5_000)).toBe(0);
  });
});

describe("clipSeconds", () => {
  const dayStart = "2025-11-20T00:00:00Z";
  const dayEnd = "2025-11-21T00:00:00Z";
  const nowMs = Date.parse("2025-11-20T12:00:00Z");

  it("完全在窗口内：整段计入", () => {
    expect(
      clipSeconds("2025-11-20T01:00:00Z", "2025-11-20T02:00:00Z", dayStart, dayEnd, nowMs),
    ).toBe(3600);
  });

  it("开始早于窗口：裁剪到 dayStart", () => {
    expect(
      clipSeconds("2025-11-19T23:00:00Z", "2025-11-20T02:00:00Z", dayStart, dayEnd, nowMs),
    ).toBe(7200);
  });

  it("结束晚于窗口：裁剪到 dayEnd", () => {
    expect(
      clipSeconds("2025-11-20T23:00:00Z", "2025-11-21T02:00:00Z", dayStart, dayEnd, nowMs),
    ).toBe(3600);
  });

  it("完全在窗口外（之前）→ 0", () => {
    expect(
      clipSeconds("2025-11-19T01:00:00Z", "2025-11-19T02:00:00Z", dayStart, dayEnd, nowMs),
    ).toBe(0);
  });

  it("完全在窗口外（之后）→ 0", () => {
    expect(
      clipSeconds("2025-11-21T01:00:00Z", "2025-11-21T02:00:00Z", dayStart, dayEnd, nowMs),
    ).toBe(0);
  });

  it("运行中条目（stoppedAt=null）：用 nowMs 作为结束", () => {
    expect(clipSeconds("2025-11-20T11:00:00Z", null, dayStart, dayEnd, nowMs)).toBe(3600);
  });

  it("毫秒零头向下取整", () => {
    expect(
      clipSeconds("2025-11-20T01:00:00.500Z", "2025-11-20T01:00:01.900Z", dayStart, dayEnd, nowMs),
    ).toBe(1);
  });
});

describe("paletteColor / paletteForegroundColor", () => {
  it("显式色板索引（1–8）优先", () => {
    expect(paletteColor(1, "anything")).toBe("var(--category-1)");
    expect(paletteColor(8, "anything")).toBe("var(--category-8)");
    expect(paletteForegroundColor(3, "anything")).toBe("var(--category-3-foreground)");
  });

  it("null/undefined/越界回退名称 hash 色", () => {
    const fallback = paletteColor(null, "x");
    expect(fallback).toMatch(/^var\(--category-[1-8]\)$/);
    expect(paletteColor(undefined, "x")).toBe(fallback);
    expect(paletteColor(0, "x")).toBe(fallback);
    expect(paletteColor(9, "x")).toBe(fallback);
    expect(paletteColor(-1, "x")).toBe(fallback);
  });

  it("hash 色确定性：同名同色，前景与背景索引一致", () => {
    expect(paletteColor(null, "读书")).toBe(paletteColor(null, "读书"));
    const bg = paletteColor(null, "abc");
    const fg = paletteForegroundColor(null, "abc");
    expect(fg).toBe(`${bg.slice(0, -1)}-foreground)`);
  });
});

describe("browserTz", () => {
  it("返回非空 string（环境相关，不断言具体值）", () => {
    const tz = browserTz();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});
