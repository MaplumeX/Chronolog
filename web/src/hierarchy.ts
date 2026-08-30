/** 两级节点最小形状（分类/标签共用于层级排序） */
export type HierNode = { id: string; name: string; parentId: string | null };

/**
 * 两级层级工具（task 08-30-hierarchical-categories-tags）：
 * 服务端返回扁平列表（parentId 指向顶层节点），这里负责排序成「顶层 + 紧随其子级」
 * 以及挑选可选父级（只允许挂到顶层）。
 */

/** 扁平列表 → 两级树序（顶层按原顺序，子级紧跟其父级），防御孤儿（parentId 指向不存在节点）不致丢失。 */
export function sortHierarchical<T extends HierNode>(items: T[]): { parent: T; children: T[] }[] {
  const known = new Set(items.map((x) => x.id));
  const tops = items.filter((x) => x.parentId === null || !known.has(x.parentId));
  const byParent = new Map<string, T[]>();
  for (const item of items) {
    if (item.parentId === null || !known.has(item.parentId)) continue;
    const list = byParent.get(item.parentId);
    if (list) list.push(item);
    else byParent.set(item.parentId, [item]);
  }
  return tops.map((parent) => ({
    parent,
    children: byParent.get(parent.id) ?? [],
  }));
}

/** 顶层节点列表（编辑「所属父级」的可选项来源；孤儿降级后同样可选）。 */
export function topLevel<T extends HierNode>(items: T[]): T[] {
  const known = new Set(items.map((x) => x.id));
  return items.filter((x) => x.parentId === null || !known.has(x.parentId));
}
