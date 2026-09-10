import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Tag } from "../api";
import { sortHierarchical } from "../hierarchy";
import { ChipGroup } from "./ChipGroup";

/**
 * 标签选择器（多选，任务 09-10-chip-pickers 由下拉菜单改为彩色胶囊平铺）。
 * 与 CategoryPicker 同为两段式层级，区别是点击 = toggle，且取消父级不连带取消子级
 * （标签无级联语义）。
 */
export function TagPicker(props: {
  tags: Tag[];
  value: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const groups = sortHierarchical(props.tags);
  // 已选子级所属的父级默认展开，避免已选项被藏在收起的子级行里（R3.4）
  const parentOfSelected =
    groups.find((g) => g.children.some((c) => props.value.includes(c.id)))?.parent.id ?? null;
  const [expandedParentId, setExpandedParentId] = useState<string | null>(parentOfSelected);
  // 外部 value 整体切换（如异步载入运行中条目的标签）时同步展开对应父级；
  // 用户自己的展开操作不受影响（仅在 value 变化的那一次渲染判定）
  const valueKey = props.value.join(",");
  const [lastValueKey, setLastValueKey] = useState(valueKey);
  if (lastValueKey !== valueKey) {
    setLastValueKey(valueKey);
    if (parentOfSelected !== null && expandedParentId === null) {
      setExpandedParentId(parentOfSelected);
    }
  }

  function toggle(id: string) {
    if (props.value.includes(id)) {
      props.onChange(props.value.filter((x) => x !== id));
    } else {
      props.onChange([...props.value, id]);
    }
  }

  return (
    <ChipGroup
      groups={groups}
      selectedIds={props.value}
      variant="outline"
      expandedParentId={expandedParentId}
      onExpandChange={setExpandedParentId}
      onSelect={toggle}
      disabled={props.disabled}
      emptyText={t("tags.empty")}
    />
  );
}
