import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { paletteColor } from "../format";
import { sortHierarchical } from "../hierarchy";
import { AddChildPopover } from "@/components/AddChildPopover";
import { NameColorEditPopover } from "@/components/NameColorEditPopover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 分类/标签共享树形列表卡片（task 08-31-redesign-categories-tags）：
 * 单张轻卡片承载整棵两级树 —— 父行（chevron 折叠 + 色点 + 名称 + 记录数 + 操作）
 * + 缩进子行（guide line）；行 hover / focus-within 显示操作按钮。
 * 纯 UI + 状态组件，不直接 import api，所有数据操作经 props 注入；
 * 两步确认（confirmingId）与折叠（collapsedIds，默认空 = 全展开）是组件内部状态。
 */
interface HierarchicalListCardProps<T extends HierarchyItem> {
  /** i18n namespace（"categories" | "tags"），同时作为 popover namespace */
  namespace: "categories" | "tags";
  items: T[];
  /** 父级可选项（topLevel 结果，页面壳计算） */
  topOptions: T[];
  onCreateChild: (parent: T, name: string) => Promise<void>;
  onUpdate: (
    item: T,
    next: { name: string; color: number; parentId: string | null },
  ) => Promise<void>;
  onDelete: (item: T) => Promise<void>;
  /** 分类页传 entryCount > 0；标签页不传 */
  deleteDisabled?: (item: T) => boolean;
}

interface HierarchyItem {
  id: string;
  name: string;
  color: number | null;
  entryCount: number;
  parentId: string | null;
}

export function HierarchicalListCard<T extends HierarchyItem>(
  props: HierarchicalListCardProps<T>,
) {
  const { t } = useTranslation();
  const ns = props.namespace;
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const rows = sortHierarchical(props.items);

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * 两步确认：首点进入确认态，再点执行。确认删除失败时不清除确认态；
   * 页面壳的 onDelete 返回 rejected promise 时在此兜底 catch，避免
   * unhandled rejection —— 错误文案由页面壳展示。
   */
  function handleDelete(item: T) {
    if (confirmingId !== item.id) {
      setConfirmingId(item.id);
      return;
    }
    void props
      .onDelete(item)
      .then(() => setConfirmingId(null))
      .catch(() => {});
  }

  /** 禁删 title 三态：deleteBlockedTitle → deleteCascadeTitle{count} → delete */
  function deleteTitle(item: T, childCount: number) {
    // deleteDisabled 仅分类页传入（占用禁删是分类侧后端 409 约束），
    // tags 无 deleteBlockedTitle key，直接引用字面量 key 保持类型安全。
    if (props.deleteDisabled?.(item)) return t("categories.deleteBlockedTitle");
    if (childCount > 0) return t(`${ns}.deleteCascadeTitle`, { count: childCount });
    return t(`${ns}.delete`);
  }

  function deleteButton(item: T, childCount: number) {
    const confirming = confirmingId === item.id;
    return (
      <Button
        type="button"
        variant={confirming ? "destructive" : "ghost"}
        size="sm"
        className={confirming ? undefined : "text-destructive hover:text-destructive"}
        title={deleteTitle(item, childCount)}
        disabled={props.deleteDisabled?.(item) ?? false}
        onClick={() => handleDelete(item)}
      >
        {confirming ? t(`${ns}.confirmDelete`) : t(`${ns}.delete`)}
      </Button>
    );
  }

  function renderRow(
    item: T,
    { isParent, childCount, indent }: { isParent: boolean; childCount: number; indent: boolean },
  ) {
    const collapsed = collapsedIds.has(item.id);
    return (
      <div
        key={item.id}
        className="group/row flex items-center gap-2 px-4 py-2"
      >
        {isParent ? (
          childCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-expanded={!collapsed}
              aria-label={collapsed ? t(`${ns}.expand`) : t(`${ns}.collapse`)}
              onClick={() => toggleCollapse(item.id)}
            >
              {collapsed ? <ChevronRight /> : <ChevronDown />}
            </Button>
          ) : (
            <span className="size-8 shrink-0" aria-hidden="true" />
          )
        ) : null}
        <span className={cn("flex min-w-0 items-center gap-2", indent && "pl-6")}>
          {indent ? (
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          ) : null}
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: paletteColor(item.color, item.name) }}
          />
          <span className={cn("truncate", isParent && "font-medium")}>
            {item.name}
          </span>
        </span>
        <span className="ml-auto pl-2 font-mono text-xs tabular-nums text-muted-foreground">
          {item.entryCount}
        </span>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100",
            confirmingId === item.id && "opacity-100",
          )}
        >
          {isParent ? (
            <AddChildPopover
              namespace={ns}
              parentName={item.name}
              onCreate={(childName) => props.onCreateChild(item, childName)}
            />
          ) : null}
          <NameColorEditPopover
            namespace={ns}
            name={item.name}
            color={item.color}
            parentOptions={props.topOptions}
            parentId={item.parentId}
            excludeId={item.id}
            onSave={(next) => props.onUpdate(item, next)}
          />
          {deleteButton(item, childCount)}
        </div>
      </div>
    );
  }

  if (props.items.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t(`${ns}.empty`)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map(({ parent, children }) => (
            <Fragment key={parent.id}>
              {renderRow(parent, { isParent: true, childCount: children.length, indent: false })}
              {!collapsedIds.has(parent.id)
                ? children.map((child) =>
                    renderRow(child, { isParent: false, childCount: 0, indent: true }),
                  )
                : null}
            </Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
