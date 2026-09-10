import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PointerEventsCheckLevel } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, Tag, TimeEntry } from "../api";
import { useIsMobile } from "../hooks/use-mobile";
import { EntryEditor } from "./EntryEditor";

// i18n 由 setup.ts 全局初始化并 pin 到 en；断言用英文文案。

vi.mock("../hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));

const useIsMobileMock = vi.mocked(useIsMobile);

/** EntryTimeRangeEditor 的 Popover / Calendar 需要 window.matchMedia（jsdom 未提供）。 */
function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList),
  );
}

const CATEGORIES: Category[] = [
  { id: "c1", name: "Work", color: 1, parentId: null, archivedAt: null, entryCount: 0 },
  {
    id: "c-old",
    name: "Archived",
    color: 4,
    parentId: null,
    archivedAt: "2024-12-01T00:00:00.000Z",
    entryCount: 0,
  },
];
const TAGS: Tag[] = [];

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "e1",
    categoryId: "c1",
    categoryName: "Work",
    description: "Task",
    startedAt: "2025-01-06T02:00:00.000Z",
    stoppedAt: "2025-01-06T03:00:00.000Z",
    durationSeconds: 3600,
    tags: [],
    ...overrides,
  };
}

function makeAdjacentEntry(id: string, offsetHours: number): TimeEntry {
  const base = Date.parse("2025-01-06T02:00:00.000Z");
  const startedAt = new Date(base + offsetHours * 3600_000).toISOString();
  const stoppedAt = new Date(base + (offsetHours + 1) * 3600_000).toISOString();
  return makeEntry({ id, startedAt, stoppedAt, durationSeconds: 3600 });
}

function renderEditor(props?: {
  entry?: TimeEntry;
  draft?: { startedAt: string; stoppedAt: string };
  prevEntry?: TimeEntry | null;
  nextEntry?: TimeEntry | null;
  categories?: Category[];
}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <EntryEditor
      entry={props?.entry}
      draft={props?.draft}
      categories={props?.categories ?? CATEGORIES}
      tags={TAGS}
      prevEntry={props?.prevEntry}
      nextEntry={props?.nextEntry}
      tz="UTC"
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("EntryEditor 按钮区（桌面）", () => {
  it("编辑模式：单行按钮组（删除 + 合并上/下 + 取消 + 保存）", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(false);
    renderEditor({
      entry: makeEntry(),
      prevEntry: makeAdjacentEntry("ep", -2),
      nextEntry: makeAdjacentEntry("en", 1),
    });

    const buttons = screen.getAllByRole("button");
    const byText = buttons.map((b) => b.textContent);
    expect(byText).toContain("Delete");
    expect(byText).toContain("Merge with previous");
    expect(byText).toContain("Merge with next");
    expect(byText).toContain("Cancel");
    expect(byText).toContain("Save");
  });

  it("draft 模式：仅取消 + 保存，无删除/合并", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(false);
    renderEditor({
      draft: { startedAt: "2025-01-06T02:00:00", stoppedAt: "2025-01-06T03:00:00" },
    });

    const texts = screen.getAllByRole("button").map((b) => b.textContent);
    expect(texts).toContain("Cancel");
    expect(texts).toContain("Save");
    expect(texts).not.toContain("Delete");
    expect(texts).not.toContain("Merge with previous");
    expect(texts).not.toContain("Merge with next");
  });

  it("保存按钮 disabled 直到选中分类", async () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(false);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderEditor({
      draft: { startedAt: "2025-01-06T02:00:00", stoppedAt: "2025-01-06T03:00:00" },
    });

    // draft categoryId 初始为 ""，保存 disabled；点分类胶囊选中后解禁
    const saveDraft = screen.getByRole("button", { name: "Save" });
    expect(saveDraft).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();

    cleanup();
    document.body.innerHTML = "";
    renderEditor({ entry: makeEntry() });
    const saveEdit = screen.getByRole("button", { name: "Save" });
    expect(saveEdit).not.toBeDisabled();
    await user.click(saveEdit);
    // API 调用本身不在本测试范围；不抛错即通过
  });
});

describe("EntryEditor 分类胶囊（D7 归档只读胶囊）", () => {
  it("编辑模式：categoryId 不命中活动分类 → 末尾追加只读胶囊（文案 = 后端 categoryName）", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(false);
    renderEditor({
      entry: makeEntry({ categoryId: "c-old", categoryName: "Archived" }),
    });

    const readonlyChip = screen.getByRole("button", { name: "Archived" });
    expect(readonlyChip).toBeDisabled();
    expect(readonlyChip).toHaveAttribute("aria-pressed", "true");
    expect(readonlyChip.className).toContain("chip--readonly");
    // 活动分类胶囊仍可选
    expect(screen.getByRole("button", { name: "Work" })).toBeEnabled();
  });

  it("改选活动分类后只读胶囊从 DOM 移除，保存仍可用", async () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(false);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderEditor({
      entry: makeEntry({ categoryId: "c-old", categoryName: "Archived" }),
    });

    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.queryByRole("button", { name: "Archived" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("draft 模式不渲染只读胶囊（新建场景不适用 D7）", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(false);
    renderEditor({
      draft: { startedAt: "2025-01-06T02:00:00", stoppedAt: "2025-01-06T03:00:00" },
    });
    expect(screen.queryByRole("button", { name: "Archived" })).not.toBeInTheDocument();
  });
});

describe("EntryEditor 按钮区（移动）", () => {
  it("编辑模式：标题行删除链接 + 合并次操作行 + 取消/保存主操作行", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(true);
    renderEditor({
      entry: makeEntry(),
      prevEntry: makeAdjacentEntry("ep", -2),
      nextEntry: makeAdjacentEntry("en", 1),
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn.className).toContain("text-destructive");
    expect(deleteBtn.className).toContain("min-h-12");

    // 合并次操作行：两个 ghost 按钮 flex-1 min-h-12
    const mergePrev = screen.getByRole("button", { name: /Merge with previous/ });
    const mergeNext = screen.getByRole("button", { name: /Merge with next/ });
    for (const btn of [mergePrev, mergeNext]) {
      expect(btn.className).toContain("min-h-12");
      expect(btn.className).toContain("flex-1");
    }

    // 主操作行：取消/保存 h-12 flex-1
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    for (const btn of [cancel, save]) {
      expect(btn.className).toContain("h-12");
      expect(btn.className).toContain("flex-1");
    }
    expect(save).not.toBeDisabled();
  });

  it("移动编辑模式：无相邻候选时合并按钮 disabled", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(true);
    renderEditor({ entry: makeEntry() });

    expect(screen.getByRole("button", { name: /Merge with previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Merge with next/ })).toBeDisabled();
  });

  it("draft 模式：无删除/合并，仅取消/保存主操作行", () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(true);
    renderEditor({
      draft: { startedAt: "2025-01-06T02:00:00", stoppedAt: "2025-01-06T03:00:00" },
    });

    const texts = screen.getAllByRole("button").map((b) => b.textContent);
    expect(texts).not.toContain("Delete");
    expect(texts).not.toContain("Merge with previous");
    expect(texts).not.toContain("Merge with next");
    expect(texts).toContain("Cancel");
    expect(texts).toContain("Save");
  });

  it("移动编辑模式：点击合并上一条打开 MergeDialog", async () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(true);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderEditor({
      entry: makeEntry(),
      prevEntry: makeAdjacentEntry("ep", -2),
    });

    await user.click(screen.getByRole("button", { name: /Merge with previous/ }));
    expect(
      await screen.findByRole("dialog", { name: "Merge entries" }),
    ).toBeInTheDocument();
  });

  it("移动编辑模式：点删除打开 ConfirmDialog", async () => {
    stubMatchMedia();
    useIsMobileMock.mockReturnValue(true);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderEditor({ entry: makeEntry() });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByRole("dialog", { name: "Delete this entry?" }),
    ).toBeInTheDocument();
  });
});
