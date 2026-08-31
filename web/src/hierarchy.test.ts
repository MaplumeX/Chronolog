import { describe, expect, it } from "vitest";
import { sortHierarchical, topLevel, type HierNode } from "./hierarchy";

function node(id: string, parentId: string | null = null): HierNode {
  return { id, name: `n-${id}`, parentId };
}

describe("sortHierarchical", () => {
  it("顶层保持原顺序，子级紧跟其父级", () => {
    const items = [node("a"), node("b"), node("a1", "a"), node("b1", "b"), node("a2", "a")];
    expect(sortHierarchical(items)).toEqual([
      { parent: node("a"), children: [node("a1", "a"), node("a2", "a")] },
      { parent: node("b"), children: [node("b1", "b")] },
    ]);
  });

  it("子级位置无关：排在父级之前的子级仍归入父级", () => {
    const items = [node("a1", "a"), node("a")];
    expect(sortHierarchical(items)).toEqual([{ parent: node("a"), children: [node("a1", "a")] }]);
  });

  it("孤儿节点（parentId 指向不存在 id）降级为顶层，不丢失", () => {
    const items = [node("a"), node("ghost", "missing")];
    expect(sortHierarchical(items)).toEqual([
      { parent: node("a"), children: [] },
      { parent: node("ghost", "missing"), children: [] },
    ]);
  });

  it("全子级（互相指向不存在的父）→ 全部孤儿降级为顶层", () => {
    const items = [node("x", "m1"), node("y", "m2")];
    const result = sortHierarchical(items);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.parent.id)).toEqual(["x", "y"]);
    expect(result.every((r) => r.children.length === 0)).toBe(true);
  });

  it("空列表 → 空结果", () => {
    expect(sortHierarchical([])).toEqual([]);
  });

  it("全顶层 → 每个 parent 的 children 为空", () => {
    const result = sortHierarchical([node("a"), node("b")]);
    expect(result).toEqual([
      { parent: node("a"), children: [] },
      { parent: node("b"), children: [] },
    ]);
  });
});

describe("topLevel", () => {
  it("只返回顶层节点", () => {
    const items = [node("a"), node("b"), node("a1", "a")];
    expect(topLevel(items).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("孤儿节点也算顶层（可作为父级候选）", () => {
    const items = [node("a"), node("ghost", "missing"), node("a1", "a")];
    expect(topLevel(items).map((x) => x.id)).toEqual(["a", "ghost"]);
  });

  it("空列表 → 空结果", () => {
    expect(topLevel([])).toEqual([]);
  });
});
