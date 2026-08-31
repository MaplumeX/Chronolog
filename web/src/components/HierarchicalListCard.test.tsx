import { cleanup, render, screen, within } from "@testing-library/react";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { paletteColor } from "../format";
import { HierarchicalListCard } from "./HierarchicalListCard";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。

interface Item {
  id: string;
  name: string;
  color: number | null;
  entryCount: number;
  parentId: string | null;
}

// radix Popover（AddChildPopover / NameColorEditPopover）portal 挂在 document.body 上，
// jsdom 下 user-event 的 pointer-events 检查会拒绝交互 → 关闭该检查；
// 同时防御性还原 body 样式，避免未关闭的浮窗泄漏到后续用例（CategoryPicker.test 惯例）。
function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.body.style.pointerEvents = "";
});

const ITEMS: Item[] = [
  { id: "work", name: "Work", color: 3, entryCount: 5, parentId: null },
  { id: "dev", name: "Dev", color: null, entryCount: 2, parentId: "work" },
  { id: "meet", name: "Meetings", color: 5, entryCount: 1, parentId: "work" },
  { id: "life", name: "Life", color: null, entryCount: 0, parentId: null },
];

function renderCard(overrides?: Partial<Parameters<typeof HierarchicalListCard<Item>>[0]>) {
  const props: Parameters<typeof HierarchicalListCard<Item>>[0] = {
    namespace: "categories",
    items: ITEMS,
    topOptions: ITEMS.filter((x) => x.parentId === null),
    onCreateChild: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<HierarchicalListCard {...props} />);
  return props;
}

/** 行定位：以行内名称文本为锚，向上找到 group/row 行容器。 */
function rowOf(name: string): HTMLElement {
  const label = screen.getByText(name);
  const row = label.closest(".group\\/row");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

describe("HierarchicalListCard 树形渲染", () => {
  it("渲染父行 + 子行层级结构、色点、记录数", () => {
    renderCard();
    // 父行名称 font-medium；子行普通字重
    expect(screen.getByText("Work")).toHaveClass("font-medium");
    expect(screen.getByText("Dev")).not.toHaveClass("font-medium");
    // 子行有 guide line，父行没有
    expect(rowOf("Dev").querySelector("span.h-4.w-px")).toBeTruthy();
    expect(rowOf("Work").querySelector("span.h-4.w-px")).toBeNull();
    // 记录数显示
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("色点用 paletteColor(color, name)，NULL 回退名称 hash", () => {
    renderCard();
    const workDot = rowOf("Work").querySelector("span.rounded-full");
    expect(workDot).toHaveStyle({ background: paletteColor(3, "Work") });
    const devDot = rowOf("Dev").querySelector("span.rounded-full");
    expect(devDot).toHaveStyle({ background: paletteColor(null, "Dev") });
  });

  it("无子级的父行不渲染 chevron，有子级的父行渲染且 aria-expanded", () => {
    renderCard();
    // Work 有子级 → chevron 按钮存在且默认展开
    const workChevron = screen.getByRole("button", { name: "Collapse sub-items" });
    expect(workChevron).toHaveAttribute("aria-expanded", "true");
    // Life 无子级 → 无对应按钮（也不会渲染 spacer 按钮）
    expect(screen.queryByRole("button", { name: "Expand sub-items" })).toBeNull();
  });
});

describe("HierarchicalListCard 折叠/展开", () => {
  it("默认展开子行 → 点击 chevron 收起 → 再点展开", async () => {
    const user = setupUser();
    renderCard();
    expect(screen.getByText("Dev")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sub-items" }));
    expect(screen.queryByText("Dev")).toBeNull();
    expect(screen.queryByText("Meetings")).toBeNull();
    // 父行本身仍可见、仍可操作
    expect(screen.getByText("Work")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand sub-items" }));
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText("Meetings")).toBeInTheDocument();
  });

  it("折叠状态独立：收起 Work 的子级不影响 Life", async () => {
    const user = setupUser();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Collapse sub-items" }));
    expect(screen.queryByText("Dev")).toBeNull();
    expect(screen.getByText("Life")).toBeInTheDocument();
  });
});

describe("HierarchicalListCard 弹窗确认删除", () => {
  it("点删除打开确认弹窗，取消不触发 onDelete；确认后触发一次且传对目标", async () => {
    const user = setupUser();
    const props = renderCard();
    await user.click(within(rowOf("Life")).getByRole("button", { name: "Delete" }));

    // 弹窗打开：标题 + 描述 + 取消/确认按钮
    expect(screen.getByRole("dialog", { name: "Delete this category?" })).toBeInTheDocument();
    expect(
      screen.getByText("This cannot be undone. Are you sure you want to delete this category?"),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    // 重新打开并确认
    await user.click(within(rowOf("Life")).getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete", hidden: false }),
    );
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "life", name: "Life" }),
    );
  });

  it("同一时间至多一个弹窗：点 B 行后弹窗目标切为 B，不误删 A", async () => {
    const user = setupUser();
    const props = renderCard();
    // 需先取消 A 弹窗再点 B（弹窗为模态）
    await user.click(within(rowOf("Life")).getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await user.click(within(rowOf("Work")).getByRole("button", { name: "Delete" }));
    // Work 是父级 → 描述带级联计数
    expect(
      screen.getByText(/will also delete 2 sub-item/),
    ).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "work", name: "Work" }),
    );
  });
});

describe("HierarchicalListCard 禁删", () => {
  it("deleteDisabled 为 true → 按钮 disabled 且 title 为 deleteBlockedTitle，点击不弹窗", async () => {
    const user = setupUser();
    renderCard({ deleteDisabled: (item) => item.entryCount > 0 });
    const btn = within(rowOf("Work")).getByRole("button", { name: "Delete" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      "title",
      "This category still has time entries and cannot be deleted",
    );
    // 子行同样受禁删约束（分类页约定：占用即禁删）
    const childBtn = within(rowOf("Dev")).getByRole("button", { name: "Delete" });
    expect(childBtn).toBeDisabled();
    // 禁删行点击不弹窗（disabled 按钮不触发）
    await user.click(btn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("HierarchicalListCard 空状态", () => {
  it("items 为空 → 显示 empty 引导文案", () => {
    renderCard({ items: [], topOptions: [] });
    expect(
      screen.getByText("No categories yet — create one to get started"),
    ).toBeInTheDocument();
  });

  it("tags namespace 空状态显示 tags.empty", () => {
    renderCard({ namespace: "tags", items: [], topOptions: [] });
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });
});
