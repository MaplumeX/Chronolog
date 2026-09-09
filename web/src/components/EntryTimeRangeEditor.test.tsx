import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntryTimeRangeEditor, parseDurationInput } from "./EntryTimeRangeEditor";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。
// 时间值契约："YYYY-MM-DDTHH:mm:ss" 本地时间字符串。

function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.body.style.pointerEvents = "";
  // setup.ts 不恢复 fake timers，本文件自行恢复。
  vi.useRealTimers();
});

function renderEditor(overrides?: Partial<Parameters<typeof EntryTimeRangeEditor>[0]>) {
  const props: Parameters<typeof EntryTimeRangeEditor>[0] = {
    startedAt: "2025-01-06T09:00:00",
    stoppedAt: "2025-01-06T11:30:00",
    onStartChange: vi.fn(),
    onStopChange: vi.fn(),
    ...overrides,
  };
  render(<EntryTimeRangeEditor {...props} />);
  return props;
}

/* ---------- parseDurationInput 纯函数 ---------- */

describe("parseDurationInput", () => {
  it("H:MM:SS 冒号式全格式", () => {
    expect(parseDurationInput("1:30:00")).toBe(5400);
    expect(parseDurationInput("0:00:45")).toBe(45);
  });

  it("H:MM 两段式", () => {
    expect(parseDurationInput("1:30")).toBe(5400);
    expect(parseDurationInput("0:05")).toBe(300);
  });

  it("单位式：90m / 1.5h / 45s（大小写、空白不敏感）", () => {
    expect(parseDurationInput("90m")).toBe(5400);
    expect(parseDurationInput("1.5h")).toBe(5400);
    expect(parseDurationInput("45s")).toBe(45);
    expect(parseDurationInput(" 90M ")).toBe(5400);
  });

  it("纯数字按分钟（Toggl 惯例）；0 合法", () => {
    expect(parseDurationInput("90")).toBe(5400);
    expect(parseDurationInput("0")).toBe(0);
  });

  it("超大值合法", () => {
    expect(parseDurationInput("1000:00:00")).toBe(3_600_000);
    expect(parseDurationInput("1000000m")).toBe(60_000_000);
  });

  it("非法输入返回 null：空串、乱串、负数", () => {
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("   ")).toBeNull();
    expect(parseDurationInput("abc")).toBeNull();
    expect(parseDurationInput("-30m")).toBeNull();
    expect(parseDurationInput("1:2:3:4")).toBeNull();
    expect(parseDurationInput("1h30m")).toBeNull();
  });
});

/* ---------- 组件交互 ---------- */

describe("EntryTimeRangeEditor 渲染与槽位展开", () => {
  it("紧凑行展示 开始 → 结束 · 时长 三个槽位", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "Edit start time" })).toHaveTextContent("09:00:00");
    expect(screen.getByRole("button", { name: "Edit end time" })).toHaveTextContent("11:30:00");
    expect(screen.getByRole("button", { name: "Edit duration" })).toHaveTextContent("2:30:00");
  });

  it("点击开始槽展开面板，再次点击收起", async () => {
    const user = setupUser();
    renderEditor();
    const slot = screen.getByRole("button", { name: "Edit start time" });
    await user.click(slot);
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    // DateAdjust 按钮可访问名 = label + 当前日期（如 "Start date 1/6, Mon"）
    expect(screen.getByRole("button", { name: /^Start date/ })).toBeInTheDocument();
    await user.click(slot);
    expect(screen.queryByLabelText("Start time")).toBeNull();
  });

  it("同一时刻至多一个展开面板：展开结束面板时开始面板收起", async () => {
    const user = setupUser();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Edit start time" }));
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit end time" }));
    expect(screen.queryByLabelText("Start time")).toBeNull();
    expect(screen.getByLabelText("End time")).toBeInTheDocument();
  });

  it("跨天时对应槽位显示日期副行；同天不显示", () => {
    const { unmount } = render(<EntryTimeRangeEditor
      startedAt="2025-01-06T22:00:00"
      stoppedAt="2025-01-07T01:00:00"
      onStartChange={() => {}}
      onStopChange={() => {}}
    />);
    const startSlot = screen.getByRole("button", { name: "Edit start time" });
    // 副行是 1/6 形式的本地日期文案（en locale：M/d + weekday 缩写）
    expect(startSlot.textContent).toMatch(/1\/6/);
    expect(screen.getByRole("button", { name: "Edit end time" }).textContent).toMatch(/1\/7/);
    unmount();

    renderEditor();
    expect(screen.getByRole("button", { name: "Edit start time" }).textContent).not.toMatch(/1\/6/);
  });
});

describe("EntryTimeRangeEditor start/end 编辑", () => {
  it("time input 提交变更（jsdom 不实现 time 输入，fireEvent 直设 value 触发 change）", async () => {
    const user = setupUser();
    const props = renderEditor();
    await user.click(screen.getByRole("button", { name: "Edit start time" }));
    const input = screen.getByLabelText("Start time") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "08:15:30" } });
    expect(props.onStartChange).toHaveBeenCalledWith("2025-01-06T08:15:30");
  });

  it("time input 清空不提交（保持当前值）", async () => {
    const user = setupUser();
    const props = renderEditor();
    await user.click(screen.getByRole("button", { name: "Edit start time" }));
    const input = screen.getByLabelText("Start time") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(props.onStartChange).not.toHaveBeenCalled();
  });
});

describe("EntryTimeRangeEditor 时长编辑", () => {
  async function openDuration(user: ReturnType<typeof setupUser>) {
    await user.click(screen.getByRole("button", { name: "Edit duration" }));
    return screen.getByLabelText("Duration") as HTMLInputElement;
  }

  it("时长输入（Enter 提交）以开始为锚反推结束时间", async () => {
    const user = setupUser();
    const props = renderEditor();
    const input = await openDuration(user);
    await user.type(input, "45m{Enter}");
    // 开始 09:00 + 45m → 结束 09:45:00
    expect(props.onStopChange).toHaveBeenCalledWith("2025-01-06T09:45:00");
  });

  it("H:MM:SS / H:MM / 纯数字格式均可提交", async () => {
    const user = setupUser();
    const props = renderEditor();
    let input = await openDuration(user);
    await user.type(input, "1:00:00{Enter}");
    await user.clear(input);
    await user.type(input, "1:00{Enter}");
    await user.clear(input);
    await user.type(input, "30{Enter}");
    expect(props.onStopChange).toHaveBeenNthCalledWith(1, "2025-01-06T10:00:00");
    expect(props.onStopChange).toHaveBeenNthCalledWith(2, "2025-01-06T10:00:00");
    expect(props.onStopChange).toHaveBeenNthCalledWith(3, "2025-01-06T09:30:00");
  });

  it("非法时长输入不落地（不调用 onStopChange，不破坏状态）", async () => {
    const user = setupUser();
    const props = renderEditor();
    const input = await openDuration(user);
    await user.type(input, "abc{Enter}");
    await user.clear(input);
    await user.type(input, "-30m{Enter}");
    await user.clear(input);
    await user.type(input, "{Enter}");
    expect(props.onStopChange).not.toHaveBeenCalled();
    // 紧凑行仍显示原时长 2:30:00
    expect(screen.getByRole("button", { name: "Edit duration" })).toHaveTextContent("2:30:00");
  });

  it("快捷 chips（15/30/60/90 分钟）反推结束时间", async () => {
    const user = setupUser();
    const props = renderEditor();
    await openDuration(user);
    await user.click(screen.getByRole("button", { name: "15m" }));
    expect(props.onStopChange).toHaveBeenCalledWith("2025-01-06T09:15:00");
    await user.click(screen.getByRole("button", { name: "90m" }));
    expect(props.onStopChange).toHaveBeenCalledWith("2025-01-06T10:30:00");
  });

  it("「到现在」直接以当前本地时刻为结束（fake timers 固定时间）", async () => {
    const user = setupUser();
    const props = renderEditor();
    await openDuration(user);
    // userEvent.click 依赖内部定时器，与 fake timers 冲突；这里用同步 fireEvent 直接触发。
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2025, 0, 6, 12, 34, 56));
      fireEvent.click(screen.getByRole("button", { name: "Until now" }));
      expect(props.onStopChange).toHaveBeenCalledWith("2025-01-06T12:34:56");
    } finally {
      vi.useRealTimers();
    }
  });

  it("超大时长（溢出 Date 范围）不落地（R6）", async () => {
    const user = setupUser();
    const props = renderEditor();
    const input = await openDuration(user);
    await user.type(input, "999999999999m{Enter}");
    expect(props.onStopChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit duration" })).toHaveTextContent("2:30:00");
  });
});
