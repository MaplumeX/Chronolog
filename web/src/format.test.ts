import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserTz,
  categoryIndex,
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
  supportedTimezones,
  tzUtcOffsetLabel,
} from "./format";

// setup.ts 已将 i18n 固定为 en（localeFor("en") → "en"）。

afterEach(() => {
  // setup.ts 不恢复 fake timers，本文件自行恢复。
  vi.useRealTimers();
});

describe("formatDuration", () => {
  it("letters（默认）：0 → 0s", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(0, "letters")).toBe("0s");
  });

  it("letters：非零单位拼接，零单位省略", () => {
    expect(formatDuration(5)).toBe("5s");
    expect(formatDuration(65)).toBe("1m 5s");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });

  it("letters：进位（59→60 秒进位到分）", () => {
    expect(formatDuration(59)).toBe("59s");
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(3599)).toBe("59m 59s");
  });

  it("letters：大小时数不截断", () => {
    expect(formatDuration(100 * 3600)).toBe("100h");
  });

  it("letters：负数钳制为 0，小数向下取整", () => {
    expect(formatDuration(-1)).toBe("0s");
    expect(formatDuration(-9999)).toBe("0s");
    expect(formatDuration(1.9)).toBe("1s");
    expect(formatDuration(59.999)).toBe("59s");
  });

  it("chinese：非零单位拼接，零单位省略；全零 → 0秒", () => {
    expect(formatDuration(0, "chinese")).toBe("0秒");
    expect(formatDuration(5, "chinese")).toBe("5秒");
    expect(formatDuration(65, "chinese")).toBe("1分5秒");
    expect(formatDuration(3600, "chinese")).toBe("1小时");
    expect(formatDuration(3661, "chinese")).toBe("1小时1分1秒");
    expect(formatDuration(-1, "chinese")).toBe("0秒");
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

describe("categoryIndex (FNV-1a)", () => {
  // 已知向量锚定：与服务端 server/test/color-hash.test.ts 用同一批名称与期望值，
  // 锚定双实现一致性（web/src/format.ts ↔ server/src/color-hash.ts）。
  const KNOWN_VECTORS: [string, number][] = [
    ["读书", 4],
    ["工作", 4],
    ["学习", 3],
    ["休息", 1],
    ["事务", 1],
    ["English", 3],
    ["a", 4],
  ];

  it("已知向量锚定", () => {
    for (const [name, expected] of KNOWN_VECTORS) {
      expect(categoryIndex(name), name).toBe(expected);
    }
  });

  it("确定性：同名两次调用一致", () => {
    for (const [name] of KNOWN_VECTORS) {
      expect(categoryIndex(name)).toBe(categoryIndex(name));
    }
  });

  it("结果恒在 0–7", () => {
    for (const [name] of KNOWN_VECTORS) {
      const idx = categoryIndex(name);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(7);
      expect(Number.isInteger(idx)).toBe(true);
    }
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

describe("supportedTimezones", () => {
  it("返回非空数组且元素为 IANA 形态字符串", () => {
    const list = supportedTimezones();
    expect(list.length).toBeGreaterThan(0);
    for (const tz of list) {
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    }
  });

  it("无重复项；常见时区在主流运行时存在", () => {
    const list = supportedTimezones();
    expect(new Set(list).size).toBe(list.length);
    // Node ≥ 18 与主流浏览器都支持 Intl.supportedValuesOf("timeZone")
    if (typeof (Intl as { supportedValuesOf?: unknown }).supportedValuesOf === "function") {
      expect(list).toContain("Asia/Shanghai");
      expect(list).toContain("America/New_York");
    }
  });
});

describe("tzUtcOffsetLabel", () => {
  // 固定瞬时：2026-06-15T00:00:00Z（北半球夏令时生效）
  const SUMMER = Date.parse("2026-06-15T00:00:00.000Z");

  it("整点偏移时区：Asia/Shanghai → UTC+08:00", () => {
    expect(tzUtcOffsetLabel("Asia/Shanghai", SUMMER)).toBe("(UTC+08:00)");
  });

  it("夏令时时区：America/New_York 夏季 → UTC-04:00", () => {
    expect(tzUtcOffsetLabel("America/New_York", SUMMER)).toBe("(UTC-04:00)");
  });

  it("半点偏移时区：Asia/Kolkata → UTC+05:30", () => {
    expect(tzUtcOffsetLabel("Asia/Kolkata", SUMMER)).toBe("(UTC+05:30)");
  });

  it("UTC → UTC+00:00", () => {
    expect(tzUtcOffsetLabel("UTC", SUMMER)).toBe("(UTC+00:00)");
  });
});
