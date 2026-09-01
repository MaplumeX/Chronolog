import { describe, expect, it } from "vitest";
import {
  filterActive,
  sortHierarchical,
  topLevel,
  type ArchivableNode,
  type HierNode,
} from "./hierarchy";

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

describe("filterActive（分类归档）", () => {
  function aNode(
    id: string,
    parentId: string | null = null,
    archivedAt: string | null = null,
  ): ArchivableNode {
    return { id, name: `n-${id}`, parentId, archivedAt };
  }

  it("全活动 → 原样返回", () => {
    const items = [aNode("a"), aNode("a1", "a"), aNode("b")];
    expect(filterActive(items)).toEqual(items);
  });

  it("父级归档 → 整个子树隐藏（含未归档子级）", () => {
    const items = [
      aNode("a", null, "2026-01-01T00:00:00.000Z"),
      aNode("a1", "a"), // 未归档但父归档 → 隐藏
      aNode("b"),
    ];
    expect(filterActive(items).map((x) => x.id)).toEqual(["b"]);
  });

  it("子级归档 → 仅隐藏该子级，父级保留", () => {
    const items = [
      aNode("a"),
      aNode("a1", "a", "2026-01-01T00:00:00.000Z"),
      aNode("a2", "a"),
    ];
    expect(filterActive(items).map((x) => x.id)).toEqual(["a", "a2"]);
  });

  it("归档孤儿节点（parentId 指向归档节点）同样隐藏", () => {
    const items = [
      aNode("a", null, "2026-01-01T00:00:00.000Z"),
      aNode("ghost", "missing"), // 孤儿降级顶层，未归档 → 保留
      aNode("orphanArchived", "missing2", "2026-01-01T00:00:00.000Z"),
    ];
    expect(filterActive(items).map((x) => x.id)).toEqual(["ghost"]);
  });

  it("空列表 → 空结果", () => {
    expect(filterActive([])).toEqual([]);
  });
});
