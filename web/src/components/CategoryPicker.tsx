import { useState } from "react";
import type { Category } from "../api";
import { sortHierarchical } from "../hierarchy";
import { ChipGroup } from "./ChipGroup";

/**
 * 分类选择器（单选，任务 09-10-chip-pickers 由下拉菜单改为彩色胶囊平铺）。
 * 两段式层级：父级行常驻，点父级 = 选中 + 展开其子级行（同时最多一个父级展开）。
 */
export function CategoryPicker(props: {
  categories: Category[];
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
  /**
   * 只读尾随胶囊名（D7）：当前值不命中候选集（归档 / 未分类）时由调用方传入；
   * 空 / 未传 = 不渲染。用户只能改选活动分类把它换掉。
   */
  readonlyName?: string | null;
  /** 无间隙换段的引导脉冲信号（D8）：true 时胶囊行短暂脉冲高亮 */
  hinted?: boolean;
}) {
  const groups = sortHierarchical(props.categories);
  // 展开态为组件内部 state（不受控、不持久化）；value 指向某子级时其父级默认展开
  const parentOfValue =
    groups.find((g) => g.children.some((c) => c.id === props.value))?.parent.id ?? null;
  const [expandedParentId, setExpandedParentId] = useState<string | null>(parentOfValue);
  // 派生初值只在挂载时生效，外部 value 后续切到别的子级时同步跟进
  const [lastValue, setLastValue] = useState(props.value);
  if (lastValue !== props.value) {
    setLastValue(props.value);
    if (parentOfValue !== null && parentOfValue !== expandedParentId) {
      setExpandedParentId(parentOfValue);
    }
  }

  return (
    <ChipGroup
      groups={groups}
      selectedIds={props.value ? [props.value] : []}
      variant="solid"
      expandedParentId={expandedParentId}
      onExpandChange={setExpandedParentId}
      onSelect={props.onChange}
      disabled={props.disabled}
      readonlyChip={props.readonlyName ? { name: props.readonlyName } : null}
      hinted={props.hinted}
    />
  );
}
