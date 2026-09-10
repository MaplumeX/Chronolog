import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category } from "../api";
import { paletteColor } from "../format";
import { CategoryPicker } from "./CategoryPicker";

// i18n 由 setup.ts 全局初始化；本组件不依赖翻译文案，仅消费 props。
// 胶囊形态（任务 09-10-chip-pickers）无 portal / 无 modal，用普通 user-event 即可。

afterEach(() => {
  cleanup();
});

const CATEGORIES: Category[] = [
  { id: "work", name: "Work", color: 3, entryCount: 0, parentId: null, archivedAt: null },
  { id: "dev", name: "Dev", color: null, entryCount: 0, parentId: "work", archivedAt: null },
  { id: "meet", name: "Meetings", color: 5, entryCount: 0, parentId: "work", archivedAt: null },
  { id: "life", name: "Life", color: null, entryCount: 0, parentId: null, archivedAt: null },
  { id: "gym", name: "Gym", color: 2, entryCount: 0, parentId: "life", archivedAt: null },
];

function renderPicker(overrides?: Partial<Parameters<typeof CategoryPicker>[0]>) {
  const props: Parameters<typeof CategoryPicker>[0] = {
    categories: CATEGORIES,
    value: "work",
    onChange: () => {},
    ...overrides,
  };
  const view = render(<CategoryPicker {...props} />);
  return { props, view };
}

const chip = (name: string) => screen.getByRole("button", { name });

describe("CategoryPicker 胶囊渲染", () => {
  it("父级行常驻，只渲染顶层分类胶囊（子级默认不渲染）", () => {
    renderPicker({ value: "" });
    expect(chip("Work")).toBeInTheDocument();
    expect(chip("Life")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dev" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gym" })).not.toBeInTheDocument();
  });

  it("顶层顺序与 sortHierarchical 保持数据源顺序（Work → Life）", () => {
    renderPicker({ value: "" });
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(names).toEqual(["Work", "Life"]);
  });

  it("选中胶囊 aria-pressed=true，其它为 false", () => {
    renderPicker({ value: "work" });
    expect(chip("Work")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Life")).toHaveAttribute("aria-pressed", "false");
  });

  it("色点用 paletteColor(color, name)；未设色按名称 hash 回退", () => {
    renderPicker({ value: "" });
    expect(chip("Work").querySelector("span.rounded-full")).toHaveStyle({
      background: paletteColor(3, "Work"),
    });
    expect(chip("Life").querySelector("span.rounded-full")).toHaveStyle({
      background: paletteColor(null, "Life"),
    });
  });

  it("选中态配色经内联 CSS 变量注入（--chip-color / --chip-foreground），非内联 background", () => {
    renderPicker({ value: "work" });
    const el = chip("Work");
    expect(el.style.getPropertyValue("--chip-color")).toBe(paletteColor(3, "Work"));
    expect(el.style.getPropertyValue("--chip-foreground")).toBe("var(--category-3-foreground)");
    // 底色规则留在 CSS 侧（.chip--solid[aria-pressed="true"]），内联不得写 background
    expect(el.style.background).toBe("");
    expect(el.className).toContain("chip--solid");
  });

  it("disabled 透传到全部胶囊", () => {
    renderPicker({ disabled: true });
    expect(chip("Work")).toBeDisabled();
    expect(chip("Life")).toBeDisabled();
  });
});

describe("CategoryPicker 两段式展开（R2.2 / R2.3）", () => {
  it("点父级胶囊 = 选中该父级 且 展开其子级行", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: "", onChange });

    await user.click(chip("Work"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("work");
    expect(chip("Dev")).toBeInTheDocument();
    expect(chip("Meetings")).toBeInTheDocument();
  });

  it("同时最多一个父级展开：点另一个父级时前一个子级行收起", async () => {
    const user = userEvent.setup();
    renderPicker({ value: "" });

    await user.click(chip("Work"));
    expect(chip("Dev")).toBeInTheDocument();

    await user.click(chip("Life"));
    expect(chip("Gym")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dev" })).not.toBeInTheDocument();
  });

  it("点子级胶囊 → onChange 以子级 id 调用一次", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: "", onChange });

    await user.click(chip("Work"));
    onChange.mockClear();
    await user.click(chip("Dev"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dev");
  });

  it("value 指向某子级 → 其父级默认展开（派生初值）", () => {
    renderPicker({ value: "gym" });
    expect(chip("Gym")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Dev" })).not.toBeInTheDocument();
  });

  it("外部 value 切到另一父级的子级 → 该父级同步展开", () => {
    const { view, props } = renderPicker({ value: "gym" });
    expect(chip("Gym")).toBeInTheDocument();
    view.rerender(<CategoryPicker {...props} value="dev" />);
    expect(chip("Dev")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Gym" })).not.toBeInTheDocument();
  });

  it("无子级的父级不带 aria-expanded", () => {
    renderPicker({ categories: [CATEGORIES[0], CATEGORIES[3]], value: "" });
    expect(chip("Work")).not.toHaveAttribute("aria-expanded");
  });

  it("选中无子级的顶层分类 → 上一个父级的子级行收起（不残留未选中父级的子级）", async () => {
    const user = userEvent.setup();
    const solo: Category = {
      id: "solo",
      name: "Solo",
      color: 6,
      entryCount: 0,
      parentId: null,
      archivedAt: null,
    };
    renderPicker({ categories: [...CATEGORIES, solo], value: "" });

    await user.click(chip("Work"));
    expect(chip("Dev")).toBeInTheDocument();

    // 本用例的 value 不受控（onChange 为 noop），只验展开态：
    // 选中 Solo 后 Work 已不再是当前选择，它的子级行不得残留
    await user.click(chip("Solo"));
    expect(screen.queryByRole("button", { name: "Dev" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Meetings" })).not.toBeInTheDocument();
  });
});

describe("CategoryPicker 归档只读胶囊（R2.5 / D7）", () => {
  it("readonlyName 非空 → 父级行末尾追加选中态只读胶囊，不可点击", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: "", readonlyName: "Archived project", onChange });

    const readonlyChip = chip("Archived project");
    expect(readonlyChip).toBeDisabled();
    expect(readonlyChip).toHaveAttribute("aria-pressed", "true");
    expect(readonlyChip).toHaveAttribute("aria-disabled");
    expect(readonlyChip.className).toContain("chip--readonly");

    // 位于父级行末尾（Work → Life → 只读）
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(names).toEqual(["Work", "Life", "Archived project"]);

    await user.click(readonlyChip).catch(() => {});
    expect(onChange).not.toHaveBeenCalled();
  });

  it("readonlyName 为空 / 未传 → 不渲染只读胶囊", () => {
    renderPicker({ value: "", readonlyName: null });
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(names).toEqual(["Work", "Life"]);
  });
});

describe("CategoryPicker 引导脉冲（D8）", () => {
  it("hinted=true → 容器带有限时长脉冲 class；false 时无", () => {
    const { view, props } = renderPicker({ value: "", hinted: true });
    const container = chip("Work").closest(".chip-group--hinted");
    expect(container).not.toBeNull();

    view.rerender(<CategoryPicker {...props} hinted={false} />);
    expect(chip("Work").closest(".chip-group--hinted")).toBeNull();
  });
});
