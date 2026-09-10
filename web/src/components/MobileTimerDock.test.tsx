import { cleanup, render, screen } from "@testing-library/react";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileTimerDock } from "./MobileTimerDock";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。

// Radix Sheet（Dialog）展开时把 body 置为 pointer-events: none（modal 行为），
// jsdom 下 user-event 的 pointer-events 检查会拒绝点击 → 关闭该检查；
// 同时防御性还原 body 样式，避免未关闭的 sheet 泄漏到后续用例。
function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

afterEach(() => {
  // Radix Sheet 的 portal 挂在 document.body 上，user-event 未正常关闭时
  // RTL 不会自动卸载它 → 手动清空 body，避免泄漏到后续用例。
  cleanup();
  document.body.innerHTML = "";
  document.body.style.pointerEvents = "";
});

type DockProps = Parameters<typeof MobileTimerDock>[0];

function renderDock(overrides?: Partial<DockProps>) {
  const props: DockProps = {
    description: "Write weekly report",
    onDescriptionChange: vi.fn(),
    categoryPicker: <button type="button">CategoryPicker</button>,
    tagPicker: <button type="button">TagPicker</button>,
    categoryColor: "var(--category-3)",
    elapsed: 2537, // 42m 17s
    running: false,
    canStart: true,
    onToggle: vi.fn(),
    error: "",
    autoOpenEditor: false,
    onAutoOpenConsumed: vi.fn(),
    ...overrides,
  };
  const dock = render(<MobileTimerDock {...props} />);
  return { props, dock };
}

describe("MobileTimerDock 胶囊渲染", () => {
  it("显示描述摘要、时长与开始按钮", () => {
    renderDock();
    expect(screen.getByText("Write weekly report")).toBeInTheDocument();
    expect(screen.getByText("42m 17s")).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Start" });
    expect(start).toBeEnabled();
  });

  it("无描述时显示 placeholder 文案", () => {
    renderDock({ description: "" });
    expect(screen.getByText("What are you working on?")).toBeInTheDocument();
  });

  it("未选分类（categoryColor null）时不渲染色点；选中时以分类色渲染", () => {
    const dot = renderDock().dock.container.querySelector(
      "span.size-2.shrink-0.rounded-full",
    );
    expect(dot).not.toBeNull();
    expect(dot).toHaveStyle({ background: "var(--category-3)" });
    cleanup();
    const empty = renderDock({ categoryColor: null }).dock.container.querySelector(
      "span.size-2.shrink-0.rounded-full",
    );
    expect(empty).toBeNull();
  });

  it("running 态显示停止按钮（destructive），未选分类时开始按钮禁用", () => {
    // running：Stop 按钮可点（即使 canStart=false，停止始终可用）
    renderDock({ running: true, canStart: false });
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
    cleanup();
    // stopped + 未选分类：Start 禁用
    renderDock({ running: false, canStart: false });
    const start = screen.getByRole("button", { name: "Start" });
    expect(start).toBeDisabled();
  });
});

describe("MobileTimerDock 交互", () => {
  it("点胶囊非按钮区域打开 sheet；关闭不影响计时", async () => {
    const { props } = renderDock();
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Expand timer editor" }));
    // sheet 打开：sr-only 标题 + 描述输入 + pickers 可见
    expect(
      screen.getByRole("dialog", { name: "Edit timer" }),
    ).toBeInTheDocument();
    const input = screen.getByPlaceholderText("What are you working on?");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("CategoryPicker")).toBeInTheDocument();
    expect(screen.getByText("TagPicker")).toBeInTheDocument();
    // sheet 内编辑描述回调透传（受控 input，回调携带完整值）
    await user.type(input, "!");
    expect(props.onDescriptionChange).toHaveBeenCalledWith(
      "Write weekly report!",
    );
    // 关闭（Esc）后胶囊仍在
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Edit timer" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Write weekly report")).toBeInTheDocument();
  });

  it("点开始/停止按钮不打开 sheet 且触发 onToggle", async () => {
    const { props } = renderDock();
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(props.onToggle).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("dialog", { name: "Edit timer" }),
    ).not.toBeInTheDocument();
  });

  it("计时中 sheet 内仍渲染两个胶囊组插槽（无只读徽章行分支，D6）", async () => {
    renderDock({ running: true });
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Expand timer editor" }));
    expect(screen.getByText("CategoryPicker")).toBeInTheDocument();
    expect(screen.getByText("TagPicker")).toBeInTheDocument();
  });

  it("error 文案在 sheet 内展示", async () => {
    renderDock({ error: "boom" });
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Expand timer editor" }));
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

describe("MobileTimerDock 无间隙换段引导（autoOpenEditor）", () => {
  it("autoOpenEditor=true 初始渲染 → sheet 已打开且内容可见", () => {
    // 无间隙换段后：信号直接展开编辑 sheet（sheet 内分类胶囊行同时脉冲引导）
    renderDock({ autoOpenEditor: true });
    expect(
      screen.getByRole("dialog", { name: "Edit timer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CategoryPicker")).toBeInTheDocument();
  });

  it("autoOpenEditor=true 时用户关闭 sheet → onAutoOpenConsumed 被调用，hook 复位后 sheet 关闭", async () => {
    const { dock, props } = renderDock({ autoOpenEditor: true });
    expect(
      screen.getByRole("dialog", { name: "Edit timer" }),
    ).toBeInTheDocument();
    const user = setupUser();
    await user.keyboard("{Escape}");
    // 用户未选分类直接关 sheet：组件通知 hook 复位信号（真实场景由 hook 状态驱动 rerender）
    expect(props.onAutoOpenConsumed).toHaveBeenCalledTimes(1);
    // 模拟 hook 复位后的 rerender：派生 open 变 false → sheet 关闭
    dock.rerender(
      <MobileTimerDock
        {...props}
        autoOpenEditor={false}
        onAutoOpenConsumed={props.onAutoOpenConsumed}
      />,
    );
    expect(
      screen.queryByRole("dialog", { name: "Edit timer" }),
    ).not.toBeInTheDocument();
  });

  it("选完分类：信号复位（autoOpenEditor 变 false）后 sheet 派生关闭", () => {
    // 实际关闭由 hook 状态驱动（onChange → setCategoryHintActive(false)）；
    // 组件侧验证信号翻 false 后受控 open 派生关闭、不再回调 onAutoOpenConsumed
    const { dock, props } = renderDock({ autoOpenEditor: true });
    expect(
      screen.getByRole("dialog", { name: "Edit timer" }),
    ).toBeInTheDocument();
    dock.rerender(
      <MobileTimerDock
        {...props}
        autoOpenEditor={false}
        onAutoOpenConsumed={props.onAutoOpenConsumed}
      />,
    );
    expect(
      screen.queryByRole("dialog", { name: "Edit timer" }),
    ).not.toBeInTheDocument();
    expect(props.onAutoOpenConsumed).not.toHaveBeenCalled();
  });

  it("autoOpenEditor=false → sheet 初始关闭；手动打开/关闭不调 onAutoOpenConsumed", async () => {
    const { props } = renderDock();
    expect(
      screen.queryByRole("dialog", { name: "Edit timer" }),
    ).not.toBeInTheDocument();
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Expand timer editor" }));
    expect(
      screen.getByRole("dialog", { name: "Edit timer" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Edit timer" }),
    ).not.toBeInTheDocument();
    expect(props.onAutoOpenConsumed).not.toHaveBeenCalled();
  });
});
