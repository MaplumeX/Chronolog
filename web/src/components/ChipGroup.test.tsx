import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { paletteColor, paletteForegroundColor } from "../format";
import { ChipGroup } from "./ChipGroup";

// 基元层 smoke（深度 A）：渲染 / 选中态 / 展开受控 / disabled / 只读胶囊，无快照。

afterEach(() => {
  cleanup();
});

const GROUPS = [
  {
    parent: { id: "p1", name: "Parent1", color: 2 },
    children: [
      { id: "c1", name: "Child1", color: null },
      { id: "c2", name: "Child2", color: 7 },
    ],
  },
  { parent: { id: "p2", name: "Parent2", color: null }, children: [] },
];

function renderGroup(overrides?: Partial<Parameters<typeof ChipGroup>[0]>) {
  const props: Parameters<typeof ChipGroup>[0] = {
    groups: GROUPS,
    selectedIds: [],
    variant: "solid",
    expandedParentId: null,
    onExpandChange: () => {},
    onSelect: () => {},
    ...overrides,
  };
  render(<ChipGroup {...props} />);
  return props;
}

const chip = (name: string) => screen.getByRole("button", { name });

describe("ChipGroup smoke", () => {
  it("渲染父级胶囊；expandedParentId 为 null 时不渲染子级", () => {
    renderGroup();
    expect(chip("Parent1")).toBeInTheDocument();
    expect(chip("Parent2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Child1" })).not.toBeInTheDocument();
  });

  it("expandedParentId 命中时渲染该父级的子级行（受控）", () => {
    renderGroup({ expandedParentId: "p1" });
    expect(chip("Child1")).toBeInTheDocument();
    expect(chip("Child2")).toBeInTheDocument();
  });

  it("selectedIds 驱动 aria-pressed（多选可同时多个）", () => {
    renderGroup({ selectedIds: ["p1", "c2"], expandedParentId: "p1" });
    expect(chip("Parent1")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Parent2")).toHaveAttribute("aria-pressed", "false");
    expect(chip("Child2")).toHaveAttribute("aria-pressed", "true");
  });

  it("点有子级的父级 → onSelect + onExpandChange(自身 id)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onExpandChange = vi.fn();
    renderGroup({ onSelect, onExpandChange });

    await user.click(chip("Parent1"));
    expect(onSelect).toHaveBeenCalledWith("p1");
    expect(onExpandChange).toHaveBeenCalledWith("p1");
  });

  it("点无子级的父级 → onExpandChange(null) 收起残留的子级行（同时最多一个展开）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onExpandChange = vi.fn();
    // p1 展开中，点无子级的 p2 后 p1 的子级行不得残留（p1 已不再选中）
    renderGroup({ expandedParentId: "p1", onSelect, onExpandChange });

    await user.click(chip("Parent2"));
    expect(onSelect).toHaveBeenCalledWith("p2");
    expect(onExpandChange).toHaveBeenCalledWith(null);
  });

  it("点子级只触发 onSelect（不改展开态）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onExpandChange = vi.fn();
    renderGroup({ expandedParentId: "p1", onSelect, onExpandChange });

    await user.click(chip("Child1"));
    expect(onSelect).toHaveBeenCalledWith("c1");
    expect(onExpandChange).not.toHaveBeenCalled();
  });

  it("disabled 禁用全部胶囊且点击不回调", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderGroup({ disabled: true, expandedParentId: "p1", onSelect });

    for (const name of ["Parent1", "Parent2", "Child1"]) {
      expect(chip(name)).toBeDisabled();
    }
    await user.click(chip("Parent1")).catch(() => {});
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("颜色经内联 CSS 变量注入，底色不写内联 background", () => {
    renderGroup({ selectedIds: ["p1"] });
    const el = chip("Parent1");
    expect(el.style.getPropertyValue("--chip-color")).toBe(paletteColor(2, "Parent1"));
    expect(el.style.getPropertyValue("--chip-foreground")).toBe(
      paletteForegroundColor(2, "Parent1"),
    );
    expect(el.style.background).toBe("");
  });

  it("variant 决定视觉类（solid / outline）", () => {
    renderGroup({ variant: "outline" });
    expect(chip("Parent1").className).toContain("chip--outline");
  });

  it("readonlyChip 渲染为选中态 disabled 尾随胶囊", () => {
    renderGroup({ readonlyChip: { name: "Archived" } });
    const el = chip("Archived");
    expect(el).toBeDisabled();
    expect(el).toHaveAttribute("aria-pressed", "true");
    expect(el.className).toContain("chip--readonly");
  });

  it("hinted 切换脉冲容器 class", () => {
    renderGroup({ hinted: true });
    expect(chip("Parent1").closest(".chip-group--hinted")).not.toBeNull();
  });

  it("无候选且无只读胶囊时渲染 emptyText", () => {
    renderGroup({ groups: [], emptyText: "nothing here" });
    expect(screen.getByText("nothing here")).toBeInTheDocument();
  });
});
