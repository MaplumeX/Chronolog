import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tag } from "../api";
import { TagPicker } from "./TagPicker";

// i18n 由 setup.ts pin 到 en；空态断言用英文文案。

afterEach(() => {
  cleanup();
});

const TAGS: Tag[] = [
  { id: "focus", name: "Focus", color: 1, entryCount: 0, parentId: null },
  { id: "deep", name: "Deep", color: null, entryCount: 0, parentId: "focus" },
  { id: "shallow", name: "Shallow", color: 4, entryCount: 0, parentId: "focus" },
  { id: "mood", name: "Mood", color: 6, entryCount: 0, parentId: null },
];

function renderPicker(overrides?: Partial<Parameters<typeof TagPicker>[0]>) {
  const props: Parameters<typeof TagPicker>[0] = {
    tags: TAGS,
    value: [],
    onChange: () => {},
    ...overrides,
  };
  const view = render(<TagPicker {...props} />);
  return { props, view };
}

const chip = (name: string) => screen.getByRole("button", { name });

describe("TagPicker 胶囊渲染", () => {
  it("父级行常驻；标签用 outline 变体", () => {
    renderPicker();
    expect(chip("Focus").className).toContain("chip--outline");
    expect(chip("Mood")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deep" })).not.toBeInTheDocument();
  });

  it("空标签列表 → 渲染 tags.empty 文案", () => {
    renderPicker({ tags: [] });
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });

  it("已选标签 aria-pressed=true", () => {
    renderPicker({ value: ["mood"] });
    expect(chip("Mood")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Focus")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("TagPicker toggle 语义（R3.2）", () => {
  it("点未选中胶囊 → 追加到 value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: [], onChange });

    await user.click(chip("Mood"));
    expect(onChange).toHaveBeenCalledWith(["mood"]);
  });

  it("点已选中胶囊 → 从 value 移除（可取消，区别于分类单选）", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: ["mood", "focus"], onChange });

    await user.click(chip("Mood"));
    expect(onChange).toHaveBeenCalledWith(["focus"]);
  });
});

describe("TagPicker 层级语义（R3.3 / R3.4）", () => {
  it("点父级 = toggle 自身 且 展开子级行", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: [], onChange });

    await user.click(chip("Focus"));
    expect(onChange).toHaveBeenCalledWith(["focus"]);
    expect(chip("Deep")).toBeInTheDocument();
    expect(chip("Shallow")).toBeInTheDocument();
  });

  it("取消选中父级不连带取消已选子级（标签无级联语义）", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: ["focus", "deep"], onChange });

    await user.click(chip("Focus"));
    // 只摘掉父级自身，子级 deep 保留
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["deep"]);
  });

  it("已选子级 → 其父级默认展开，已选项不被隐藏", () => {
    renderPicker({ value: ["shallow"] });
    expect(chip("Shallow")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Deep")).toBeInTheDocument();
  });

  it("外部 value 异步载入已选子级 → 父级同步展开", () => {
    const { view, props } = renderPicker({ value: [] });
    expect(screen.queryByRole("button", { name: "Deep" })).not.toBeInTheDocument();
    view.rerender(<TagPicker {...props} value={["deep"]} />);
    expect(chip("Deep")).toHaveAttribute("aria-pressed", "true");
  });

  it("已选子级下点无子级的另一父级：已选子级仍可见（派生展开兼容手风琴收起）", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<string[]>(["deep"]);
      return <TagPicker tags={TAGS} value={value} onChange={setValue} />;
    }
    render(<Controlled />);
    expect(chip("Deep")).toHaveAttribute("aria-pressed", "true");

    await user.click(chip("Mood"));
    expect(chip("Mood")).toHaveAttribute("aria-pressed", "true");
    // Mood 无子级 → 收起 Focus，但子级 Deep 仍选中 → R3.4 派生规则重新展开
    expect(chip("Deep")).toHaveAttribute("aria-pressed", "true");
  });
});
