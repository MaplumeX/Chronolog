import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimeEntry } from "../../api";
import {
  NULL_CATEGORY_KEY,
  countDays,
  coverageDays,
  dailyByCategory,
  dayWindowMs,
  deltaPercent,
  fromLocalDate,
  hourlyByCategory,
  longestStreak,
  monthBounds,
  shiftDate,
  toDate,
  toLocalDate,
  toWeekStart,
  todayIn,
  tzWallHourMs,
} from "./stats-utils";

// 固定时间戳常量；todayIn 用 vi.setSystemTime 固定系统时间（afterEach 恢复真实时间）。
afterEach(() => {
  vi.useRealTimers();
});

function mkEntry(
  startedAt: string,
  stoppedAt: string | null,
  categoryId: string | null = "c1",
  categoryName = "Cat 1",
): TimeEntry {
  return {
    id: `${startedAt}-${stoppedAt ?? "run"}`,
    categoryId,
    categoryName,
    description: "",
    startedAt,
    stoppedAt,
    durationSeconds: 0,
    tags: [],
  };
}

/* ---------- 迁移的纯日历函数 ---------- */

describe("toDate / shiftDate", () => {
  it("toDate 得到 UTC 午夜", () => {
    expect(toDate("2024-06-15").toISOString()).toBe("2024-06-15T00:00:00.000Z");
  });

  it("shiftDate 跨月进位", () => {
    expect(shiftDate("2024-01-31", 1)).toBe("2024-02-01");
    expect(shiftDate("2024-02-28", 1)).toBe("2024-02-29"); // 闰年
    expect(shiftDate("2023-02-28", 1)).toBe("2023-03-01"); // 平年
    expect(shiftDate("2024-12-31", 1)).toBe("2025-01-01");
    expect(shiftDate("2024-06-15", -16)).toBe("2024-05-30");
  });
});

describe("toWeekStart", () => {
  it("周日归上一周周一（ISO 周一对齐）", () => {
    expect(toWeekStart("2024-09-15")).toBe("2024-09-09"); // 周日
  });

  it("周一归自身，其余归本周周一", () => {
    expect(toWeekStart("2024-09-09")).toBe("2024-09-09"); // 周一
    expect(toWeekStart("2024-09-11")).toBe("2024-09-09"); // 周三
    expect(toWeekStart("2024-09-14")).toBe("2024-09-09"); // 周六
  });

  it("跨月/跨年边界", () => {
    expect(toWeekStart("2025-01-01")).toBe("2024-12-30"); // 周三，周一在上月
    expect(toWeekStart("2024-03-01")).toBe("2024-02-26"); // 周五
  });
});

describe("todayIn", () => {
  it("固定系统时间下按 tz 取当地日期", () => {
    vi.setSystemTime(new Date("2024-06-15T20:00:00Z"));
    expect(todayIn("UTC")).toBe("2024-06-15");
    expect(todayIn("Asia/Shanghai")).toBe("2024-06-16"); // 当地 06-16 04:00
    expect(todayIn("America/New_York")).toBe("2024-06-15"); // 当地 16:00
  });
});

describe("countDays", () => {
  it("闭区间天数", () => {
    expect(countDays("2024-06-15", "2024-06-15")).toBe(1);
    expect(countDays("2024-06-15", "2024-06-21")).toBe(7);
    expect(countDays("2024-02-01", "2024-02-29")).toBe(29); // 闰年
  });
});

describe("monthBounds", () => {
  it("平年二月", () => {
    expect(monthBounds("2023-02-10")).toEqual({
      from: "2023-02-01",
      to: "2023-02-28",
    });
  });

  it("闰年二月", () => {
    expect(monthBounds("2024-02-10")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });

  it("31 天月与 30 天月", () => {
    expect(monthBounds("2024-12-05")).toEqual({
      from: "2024-12-01",
      to: "2024-12-31",
    });
    expect(monthBounds("2024-04-05")).toEqual({
      from: "2024-04-01",
      to: "2024-04-30",
    });
  });

  it("跨年：12 月与 1 月互不影响", () => {
    expect(monthBounds("2024-12-31")).toEqual({
      from: "2024-12-01",
      to: "2024-12-31",
    });
    expect(monthBounds("2025-01-01")).toEqual({
      from: "2025-01-01",
      to: "2025-01-31",
    });
  });
});

describe("toLocalDate / fromLocalDate", () => {
  it("本地午夜往返", () => {
    const d = toLocalDate("2024-06-15");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(fromLocalDate(d)).toBe("2024-06-15");
    expect(fromLocalDate(new Date(2024, 0, 9))).toBe("2024-01-09"); // 个位数补零
  });
});

/* ---------- tz 换算 ---------- */

describe("tzWallHourMs / dayWindowMs", () => {
  it("UTC：墙时即 UTC", () => {
    expect(tzWallHourMs("UTC", "2024-06-15", 0)).toBe(Date.UTC(2024, 5, 15, 0));
    expect(tzWallHourMs("UTC", "2024-06-15", 14)).toBe(
      Date.UTC(2024, 5, 15, 14),
    );
  });

  it("固定偏移时区（Asia/Shanghai +8）", () => {
    expect(tzWallHourMs("Asia/Shanghai", "2024-06-15", 0)).toBe(
      Date.UTC(2024, 5, 14, 16),
    );
    const win = dayWindowMs("Asia/Shanghai", "2024-06-15");
    expect(win.endMs - win.startMs).toBe(86400000);
  });

  it("DST 春季跳变：日窗口 23h", () => {
    // America/New_York 2024-03-10 02:00 跳到 03:00
    const win = dayWindowMs("America/New_York", "2024-03-10");
    expect((win.endMs - win.startMs) / 1000).toBe(82800);
  });

  it("DST 秋季回拨：日窗口 25h", () => {
    // America/New_York 2024-11-03 02:00 回拨到 01:00
    const win = dayWindowMs("America/New_York", "2024-11-03");
    expect((win.endMs - win.startMs) / 1000).toBe(90000);
  });
});

/* ---------- hourlyByCategory ---------- */

describe("hourlyByCategory", () => {
  const DATE = "2024-06-15";
  const NOW = Date.UTC(2024, 5, 15, 23, 59, 59); // 当日末尾（不影响已停止条目）

  it("跨小时条目按重叠秒数分摊到两桶", () => {
    const r = hourlyByCategory(
      [mkEntry("2024-06-15T10:30:00Z", "2024-06-15T11:15:00Z")],
      "UTC",
      DATE,
      NOW,
    );
    expect(r.hours[10].categories["c1"]).toBe(1800); // 10:30–11:00
    expect(r.hours[11].categories["c1"]).toBe(900); // 11:00–11:15
    expect(r.hours[9].categories["c1"]).toBeUndefined();
    expect(r.coveredSeconds).toBe(2700);
  });

  it("同桶内不同分类各自累加，未分类用空串 key", () => {
    const r = hourlyByCategory(
      [
        mkEntry("2024-06-15T09:00:00Z", "2024-06-15T09:30:00Z", "c1", "Cat 1"),
        mkEntry("2024-06-15T09:10:00Z", "2024-06-15T09:40:00Z", null, "未分类"),
      ],
      "UTC",
      DATE,
      NOW,
    );
    expect(r.hours[9].categories["c1"]).toBe(1800);
    expect(r.hours[9].categories[NULL_CATEGORY_KEY]).toBe(1800);
    expect(r.categoryNames["c1"]).toBe("Cat 1");
    expect(r.categoryNames[NULL_CATEGORY_KEY]).toBe("未分类");
  });

  it("运行中条目右端按 nowMs 裁剪", () => {
    const now = Date.UTC(2024, 5, 15, 12, 30, 0);
    const r = hourlyByCategory(
      [mkEntry("2024-06-15T11:45:00Z", null)],
      "UTC",
      DATE,
      now,
    );
    expect(r.hours[11].categories["c1"]).toBe(900); // 11:45–12:00
    expect(r.hours[12].categories["c1"]).toBe(1800); // 12:00–12:30
    expect(r.hours[13].categories["c1"]).toBeUndefined();
    expect(r.coveredSeconds).toBe(2700);
  });

  it("跨午夜条目（前日深夜开始）裁剪到当日窗口", () => {
    const r = hourlyByCategory(
      [mkEntry("2024-06-14T23:00:00Z", "2024-06-15T01:00:00Z")],
      "UTC",
      DATE,
      NOW,
    );
    expect(r.hours[0].categories["c1"]).toBe(3600);
    expect(r.hours[23].categories["c1"]).toBeUndefined();
    expect(r.coveredSeconds).toBe(3600);
  });

  it("跨午夜条目（当日深夜开始、次日结束）只计入当日部分", () => {
    const r = hourlyByCategory(
      [mkEntry("2024-06-15T23:00:00Z", "2024-06-16T02:00:00Z")],
      "UTC",
      DATE,
      NOW,
    );
    expect(r.hours[23].categories["c1"]).toBe(3600);
    expect(r.coveredSeconds).toBe(3600);
    expect(r.windowSeconds).toBe(86400);
  });

  it("未记录桶：空日全 24 桶各 3600；部分覆盖按桶余量", () => {
    const r = hourlyByCategory(
      [mkEntry("2024-06-15T10:30:00Z", "2024-06-15T11:15:00Z")],
      "UTC",
      DATE,
      NOW,
    );
    expect(r.hours[0].unlogged).toBe(3600);
    expect(r.hours[10].unlogged).toBe(1800);
    expect(r.hours[11].unlogged).toBe(2700);
    const totalUnlogged = r.hours.reduce((sum, h) => sum + h.unlogged, 0);
    expect(totalUnlogged).toBe(86400 - 2700);
  });

  it("完全在窗口外/之外的条目被忽略", () => {
    const r = hourlyByCategory(
      [
        mkEntry("2024-06-13T00:00:00Z", "2024-06-13T01:00:00Z"), // 早于窗口
        mkEntry("2024-06-16T00:00:00Z", "2024-06-16T01:00:00Z"), // 晚于窗口（且早于 now 不影响）
      ],
      "UTC",
      DATE,
      NOW,
    );
    expect(r.coveredSeconds).toBe(0);
    expect(r.hours.every((h) => h.unlogged === 3600)).toBe(true);
  });

  it("DST 跳变日：窗口 82800s，桶宽自适应，总未记录守恒", () => {
    // America/New_York 2024-03-10：02:00 不存在，当天 23h
    const r = hourlyByCategory(
      [mkEntry("2024-03-10T13:00:00Z", "2024-03-10T15:00:00Z")], // 当地 08:00–10:00（EST→EDT 跨界各 1h）
      "America/New_York",
      "2024-03-10",
      Date.UTC(2024, 2, 11, 3, 59, 59),
    );
    expect(r.windowSeconds).toBe(82800);
    expect(r.coveredSeconds).toBe(7200);
    const totalUnlogged = r.hours.reduce((sum, h) => sum + h.unlogged, 0);
    expect(totalUnlogged).toBe(82800 - 7200);
    // 桶宽总和 = 窗口宽
    expect(
      r.hours.reduce((sum, h) => sum + (h.endMs - h.startMs) / 1000, 0),
    ).toBe(82800);
  });
});

/* ---------- dailyByCategory ---------- */

describe("dailyByCategory", () => {
  const TZ = "UTC";

  function daysOf(from: string, n: number) {
    return Array.from({ length: n }, (_, i) => ({
      date: shiftDate(from, i),
      seconds: 0,
    }));
  }

  it("逐日分桶 + 每日未记录 = 窗口 − 已覆盖", () => {
    const r = dailyByCategory(
      [mkEntry("2024-06-10T10:00:00Z", "2024-06-10T12:00:00Z")],
      TZ,
      daysOf("2024-06-10", 3),
      Date.UTC(2024, 6, 12),
    );
    expect(r.days[0].categories["c1"]).toBe(7200);
    expect(r.days[0].unlogged).toBe(86400 - 7200);
    expect(r.days[1].unlogged).toBe(86400);
    expect(r.days[2].unlogged).toBe(86400);
  });

  it("跨午夜条目切分到两天", () => {
    const r = dailyByCategory(
      [mkEntry("2024-06-10T22:00:00Z", "2024-06-11T02:00:00Z")],
      TZ,
      daysOf("2024-06-10", 2),
      Date.UTC(2024, 6, 12),
    );
    expect(r.days[0].categories["c1"]).toBe(7200); // 22:00–24:00
    expect(r.days[1].categories["c1"]).toBe(7200); // 00:00–02:00
  });

  it("运行中条目右端按 nowMs 裁剪", () => {
    const r = dailyByCategory(
      [mkEntry("2024-06-10T10:00:00Z", null)],
      TZ,
      daysOf("2024-06-10", 2),
      Date.UTC(2024, 5, 10, 11, 0, 0),
    );
    expect(r.days[0].categories["c1"]).toBe(3600);
    expect(r.days[1].categories["c1"]).toBeUndefined();
  });

  it("分类名表含未分类空串 key", () => {
    const r = dailyByCategory(
      [mkEntry("2024-06-10T10:00:00Z", "2024-06-10T11:00:00Z", null, "未分类")],
      TZ,
      daysOf("2024-06-10", 1),
      Date.UTC(2024, 6, 12),
    );
    expect(r.categoryNames[NULL_CATEGORY_KEY]).toBe("未分类");
    expect(r.days[0].categories[NULL_CATEGORY_KEY]).toBe(3600);
  });
});

/* ---------- deltaPercent / longestStreak / coverageDays ---------- */

describe("deltaPercent", () => {
  it("上期为 0 → null（含双方均为 0）", () => {
    expect(deltaPercent(100, 0)).toBeNull();
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it("正常涨跌", () => {
    expect(deltaPercent(150, 100)).toBe(50);
    expect(deltaPercent(50, 100)).toBe(-50);
    expect(deltaPercent(100, 100)).toBe(0);
    expect(deltaPercent(0, 100)).toBe(-100);
  });
});

describe("longestStreak", () => {
  const days = (seconds: number[], start = "2024-06-01") =>
    seconds.map((s, i) => ({ date: shiftDate(start, i), seconds: s }));

  it("全空 → 0", () => {
    expect(longestStreak(days([0, 0, 0]))).toBe(0);
    expect(longestStreak([])).toBe(0);
  });

  it("全满 → n", () => {
    expect(longestStreak(days([1, 1, 1, 1]))).toBe(4);
  });

  it("断续取最长连续段", () => {
    expect(longestStreak(days([1, 1, 0, 1, 0, 0, 1, 1, 1]))).toBe(3);
  });

  it("单日 → 1", () => {
    expect(longestStreak(days([1]))).toBe(1);
    expect(longestStreak(days([0, 1, 0]))).toBe(1);
  });

  it("按日期邻接判断：日期数组中存在缺口则不算连续", () => {
    // 06-01、06-02、06-05（缺 03/04）都有记录 → 最长 2
    expect(
      longestStreak([
        { date: "2024-06-01", seconds: 100 },
        { date: "2024-06-02", seconds: 100 },
        { date: "2024-06-05", seconds: 100 },
      ]),
    ).toBe(2);
  });
});

describe("coverageDays", () => {
  const mk = (dates: string[], recorded: Set<string>) =>
    dates.map((d) => ({ date: d, seconds: recorded.has(d) ? 100 : 0 }));

  it("今天在内：分母含今天", () => {
    const days = mk(
      ["2024-06-01", "2024-06-02", "2024-06-03"],
      new Set(["2024-06-01", "2024-06-03"]),
    );
    expect(coverageDays(days, "2024-06-03", "2024-06-30")).toEqual({
      recorded: 2,
      elapsed: 3,
    });
  });

  it("未来日期不计入分母", () => {
    const days = mk(
      ["2024-06-01", "2024-06-02", "2024-06-03"],
      new Set(["2024-06-01"]),
    );
    expect(coverageDays(days, "2024-06-02", "2024-06-30")).toEqual({
      recorded: 1,
      elapsed: 2,
    });
  });

  it("今天在月末之后（查看历史月份）：分母封顶到月末", () => {
    const days = mk(
      ["2024-05-01", "2024-05-02", "2024-05-03"],
      new Set(["2024-05-01", "2024-05-02"]),
    );
    expect(coverageDays(days, "2024-06-10", "2024-05-31")).toEqual({
      recorded: 2,
      elapsed: 3,
    });
  });

  it("空月 → 0/0", () => {
    expect(coverageDays([], "2024-06-10", "2024-06-30")).toEqual({
      recorded: 0,
      elapsed: 0,
    });
  });
});
