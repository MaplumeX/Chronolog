import { cleanup, render, screen } from "@testing-library/react";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category } from "../api";
import { paletteColor } from "../format";
import { CategoryPicker } from "./CategoryPicker";

// i18n 由 setup.ts 全局初始化；本组件不依赖翻译文案，仅消费 props。

// radix DropdownMenu 展开时会把 body 置为 pointer-events: none（modal 行为），
// jsdom 下 user-event 的 pointer-events 检查会因此拒绝点击 → 关闭该检查；
// 同时防御性还原 body 样式，避免未关闭的菜单泄漏到后续用例。
function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

afterEach(() => {
  // radix DropdownMenu 的 portal 挂在 document.body 上，user-event 未正常
  // 关闭菜单时 RTL 不会自动卸载它 → 手动清空 body，避免泄漏到后续用例。
  cleanup();
  document.body.innerHTML = "";
  document.body.style.pointerEvents = "";
});

const CATEGORIES: Category[] = [
  { id: "work", name: "Work", color: 3, entryCount: 0, parentId: null, archivedAt: null },
  { id: "dev", name: "Dev", color: null, entryCount: 0, parentId: "work", archivedAt: null },
  { id: "meet", name: "Meetings", color: 5, entryCount: 0, parentId: "work", archivedAt: null },
  { id: "life", name: "Life", color: null, entryCount: 0, parentId: null, archivedAt: null },
];

function renderPicker(overrides?: Partial<Parameters<typeof CategoryPicker>[0]>) {
  const props: Parameters<typeof CategoryPicker>[0] = {
    categories: CATEGORIES,
    value: "work",
    label: "Work",
    colorName: "Work",
    onChange: () => {},
    ...overrides,
  };
  render(<CategoryPicker {...props} />);
  return props;
}

describe("CategoryPicker 渲染", () => {
  it("trigger 渲染当前选中分类的 label", () => {
    renderPicker();
    const trigger = screen.getByRole("button", { name: "Work" });
    expect(trigger).toBeInTheDocument();
  });

  it("选中分类显式设色 → trigger 色点用 paletteColor(color, name)", () => {
    renderPicker();
    const trigger = screen.getByRole("button", { name: "Work" });
    const dot = trigger.querySelector("span.rounded-full");
    expect(dot).toHaveStyle({ background: paletteColor(3, "Work") });
  });

  it("选中分类未设色（color: null）→ 回退 paletteColor(null, colorName)", () => {
    renderPicker({ value: "life", label: "Life", colorName: "Life" });
    const trigger = screen.getByRole("button", { name: "Life" });
    const dot = trigger.querySelector("span.rounded-full");
    expect(dot).toHaveStyle({ background: paletteColor(null, "Life") });
  });

  it("无选中分类（value 不命中）→ 色点按 colorName hash 回退", () => {
    renderPicker({ value: "", label: "Select…", colorName: "Select…" });
    const trigger = screen.getByRole("button", { name: "Select…" });
    const dot = trigger.querySelector("span.rounded-full");
    expect(dot).toHaveStyle({ background: paletteColor(null, "Select…") });
  });

  it("disabled 透传到 trigger 按钮", () => {
    renderPicker({ disabled: true });
    expect(screen.getByRole("button", { name: "Work" })).toBeDisabled();
  });
});

describe("CategoryPicker 下拉交互（radix portal）", () => {
  it("展开后展示全部顶层与子级分类项", async () => {
    const user = setupUser();
    renderPicker();
    await user.click(screen.getByRole("button", { name: "Work" }));
    for (const name of ["Work", "Dev", "Meetings", "Life"]) {
      expect(await screen.findByRole("menuitem", { name })).toBeInTheDocument();
    }
  });

  it("层级排序：子级紧跟其父级（Work → Dev → Meetings → Life）", async () => {
    const user = setupUser();
    renderPicker();
    await user.click(screen.getByRole("button", { name: "Work" }));
    await screen.findByRole("menuitem", { name: "Dev" });
    const names = screen
      .getAllByRole("menuitem")
      .map((el) => el.textContent?.trim());
    expect(names).toEqual(["Work", "Dev", "Meetings", "Life"]);
  });

  it("点击顶层项 → onChange 以该 id 调用一次", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderPicker({ onChange });
    await user.click(screen.getByRole("button", { name: "Work" }));
    await user.click(await screen.findByRole("menuitem", { name: "Life" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("life");
  });

  it("点击子级项 → onChange 以子级 id 调用一次", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderPicker({ onChange });
    await user.click(screen.getByRole("button", { name: "Work" }));
    await user.click(await screen.findByRole("menuitem", { name: "Dev" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dev");
  });

  it("选中项带 bg-accent 高亮", async () => {
    const user = setupUser();
    renderPicker({ value: "dev", label: "Dev", colorName: "Dev" });
    await user.click(screen.getByRole("button", { name: "Dev" }));
    const item = await screen.findByRole("menuitem", { name: "Dev" });
    // 注意基类含 focus:bg-accent，需按独立 token 断言，不能用 toContain 子串
    const tokensOf = (el: HTMLElement) => el.className.split(/\s+/);
    expect(tokensOf(item)).toContain("bg-accent");
    expect(
      tokensOf(screen.getByRole("menuitem", { name: "Work" })),
    ).not.toContain("bg-accent");
  });

  it("菜单项色点按各自 color/name 回退（子级未设色时按名称 hash）", async () => {
    const user = setupUser();
    renderPicker();
    await user.click(screen.getByRole("button", { name: "Work" }));
    const devItem = await screen.findByRole("menuitem", { name: "Dev" });
    const dot = devItem.querySelector("span.rounded-full");
    expect(dot).toHaveStyle({ background: paletteColor(null, "Dev") });
  });
});
