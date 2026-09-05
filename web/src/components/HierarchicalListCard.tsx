import { Fragment, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Measurable } from "@radix-ui/rect";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { paletteColor } from "../format";
import { sortHierarchical } from "../hierarchy";
import { AddChildPopoverForm } from "@/components/AddChildPopover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NameColorEditPopoverForm } from "@/components/NameColorEditPopover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * 分类/标签共享树形列表卡片（task 08-31-redesign-categories-tags）：
 * 单张轻卡片承载整棵两级树 —— 父行（chevron 折叠 + 色点 + 名称 + 记录数 + 操作）
 * + 缩进子行（guide line）；行 hover / focus-within 显示操作按钮。
 * 行操作收入 `⋯` 下拉菜单（task 09-01-row-actions-menu）：
 * 添加子项 / 编辑菜单项点击后关闭菜单，把对应 Popover 锚定到
 * `⋯` 按钮打开（PopoverAnchor，controlled open，交互语义不变）；
 * 归档/取消归档、删除沿用原有确认弹窗流程。
 * 纯 UI + 状态组件，不直接 import api，所有数据操作经 props 注入；
 * 删除确认弹窗（pendingDelete，同一时间至多一个）与折叠（collapsedIds，
 * 默认空 = 全展开）是组件内部状态。
 *
 * 分类归档功能：items 带 `archivedAt` 字段（分类侧）时启用归档分区渲染 ——
 * 活动区在前，归档区在后（独立分隔标题行「已归档 (n)」，默认折叠）；
 * tags 无归档概念（无 archivedAt 字段），走原有单一列表路径，行为完全不变。
 */
interface HierarchicalListCardProps<T extends HierarchyItem> {
  /** i18n namespace（"categories" | "tags"），同时作为 popover namespace */
  namespace: "categories" | "tags";
  items: T[];
  /** 父级可选项（topLevel 结果，页面壳计算；归档父级已被上游过滤） */
  topOptions: T[];
  onCreateChild: (parent: T, name: string) => Promise<void>;
  onUpdate: (
    item: T,
    next: { name: string; color: number; parentId: string | null },
  ) => Promise<void>;
  onDelete: (item: T) => Promise<void>;
  /** 归档/取消归档（仅分类页传入；未传则不显示归档按钮） */
  onArchive?: (item: T) => Promise<void>;
  onUnarchive?: (item: T) => Promise<void>;
}

interface HierarchyItem {
  id: string;
  name: string;
  color: number | null;
  entryCount: number;
  parentId: string | null;
}

/** 归档分区渲染需要的历史信息（分类归档确认弹窗描述插值用） */
interface ArchiveContext {
  /** 目标自身归档时：将被连带归档的活动子分类数（仅父级） */
  childCount: number;
  /** 取消归档时：仍在归档状态的祖先数（级联恢复父级链） */
  archivedAncestorCount: number;
}

export function HierarchicalListCard<T extends HierarchyItem>(
  props: HierarchicalListCardProps<T>,
) {
  const { t } = useTranslation();
  const ns = props.namespace;
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  /** 待删除行（弹窗目标）：单项 = 单弹窗；childCount 用于级联描述插值 */
  const [pendingDelete, setPendingDelete] = useState<{
    item: T;
    childCount: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** 待归档/取消归档行（弹窗目标）；archive = 归档，unarchive = 取消归档 */
  const [pendingArchive, setPendingArchive] = useState<{
    action: "archive" | "unarchive";
    item: T;
    context: ArchiveContext;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  /** 行级菜单弹层目标：菜单项「添加子项 / 编辑」点击后关闭菜单并锚定 ⋯ 按钮打开 */
  const [popoverTarget, setPopoverTarget] = useState<{
    kind: "addChild" | "edit";
    item: T;
    anchor: Measurable | null;
  } | null>(null);
  /** PopoverAnchor virtualRef 需要 RefObject 形态 */
  const anchorRef = useRef<Measurable | null>(null);
  /** 归档区折叠状态（默认折叠） */
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);

  /** PopoverAnchor virtualRef 需要 RefObject 形态；跟随 popoverTarget 更新 */
  anchorRef.current = popoverTarget?.anchor ?? null;
  /** 各行 ⋯ 菜单触发按钮（菜单项 onSelect 时 React 合成事件的 currentTarget 已置空，
   * 改由 ref 记录触发按钮，作为弹层锚点） */
  const triggerEls = useRef(new Map<string, HTMLElement>());

  const rows = sortHierarchical(props.items);
  // 行数变化后同步菜单触发按钮缓存（含首次渲染）：PopoverAnchor virtualRef 需要可用锚点
  triggerEls.current.forEach((_, id) => {
    if (
      !rows.some(
        (r) => r.parent.id === id || r.children.some((c) => c.id === id),
      )
    ) {
      triggerEls.current.delete(id);
    }
  });
  // 归档分区仅在 items 带 archivedAt 字段且提供归档回调时启用（tags 不传 → 单列表）
  const archiveEnabled = props.onArchive != null;
  const isArchived = (item: T): boolean =>
    archiveEnabled &&
    "archivedAt" in item &&
    (item as { archivedAt: string | null }).archivedAt !== null;
  const activeRows = archiveEnabled
    ? rows
        .filter(({ parent }) => !isArchived(parent))
        .map(({ parent, children }) => ({
          parent,
          children: children.filter((c) => !isArchived(c)),
        }))
    : rows;
  // 归档区：归档的顶层父级（连带其全部子级）+ 挂在活动父级下的归档子级（作为独立行）
  const archivedRows = archiveEnabled
    ? rows.flatMap(({ parent, children }) =>
        isArchived(parent)
          ? [{ parent, children }]
          : children
              .filter((c) => isArchived(c))
              .map((c) => ({ parent: c, children: [] as T[] })),
      )
    : [];
  const archivedCount = archiveEnabled
    ? archivedRows.reduce((n, { children }) => n + 1 + children.length, 0)
    : 0;

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * 弹窗确认删除：页面壳的 onDelete 若 reject，错误文案由页面壳展示，
   * 在此兜底 catch 避免 unhandled rejection；成功才关弹窗（失败可重试）。
   */
  function handleConfirmDelete() {
    const target = pendingDelete;
    if (!target || deleting) return;
    setDeleting(true);
    void props
      .onDelete(target.item)
      .then(() => setPendingDelete(null))
      .catch(() => {})
      .finally(() => setDeleting(false));
  }

  /** 归档/取消归档确认：同删除弹窗的 pending 语义（失败保持弹窗可重试） */
  function handleConfirmArchive() {
    const target = pendingArchive;
    if (!target || archiving) return;
    const fn =
      target.action === "archive" ? props.onArchive : props.onUnarchive;
    if (!fn) return;
    setArchiving(true);
    void fn(target.item)
      .then(() => setPendingArchive(null))
      .catch(() => {})
      .finally(() => setArchiving(false));
  }

  /** 计算归档/取消归档弹窗目标（菜单项复用，沿用原上下文插值逻辑） */
  function archiveTarget(
    item: T,
    isParent: boolean,
    action: "archive" | "unarchive",
  ) {
    return {
      action,
      item,
      context: {
        childCount:
          action === "archive" && isParent ? activeChildCount(item) : 0,
        archivedAncestorCount:
          action === "unarchive" ? countArchivedAncestors(item) : 0,
      },
    };
  }

  /** 目标父级下仍活动的子分类数（归档描述插值：连带归档 n 个子分类） */
  function activeChildCount(parent: T): number {
    const row = rows.find((r) => r.parent.id === parent.id);
    if (!row) return 0;
    return row.children.filter((c) => !isArchived(c)).length;
  }

  /** 沿 parentId 链向上仍在归档状态的祖先数（取消归档级联恢复提示） */
  function countArchivedAncestors(item: T): number {
    let n = 0;
    const byId = new Map(props.items.map((x) => [x.id, x] as const));
    let cur = item.parentId != null ? byId.get(item.parentId) : undefined;
    while (cur != null) {
      if (isArchived(cur)) n += 1;
      cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
    }
    return n;
  }

  /**
   * Popover focus-outside 守卫：菜单项 onSelect 关闭 DropdownMenu 后，鼠标
   * 滑出菜单项时 Radix MenuItem 的 onPointerLeave → onItemLeave 仍会执行
   * `contentRef.current?.focus()`，把焦点抢回已关闭的菜单容器；这个
   * focusin 发生在新打开的弹层之外，Popover 判定为 focus-outside 而立即
   * 关闭（真实浏览器可复现，jsdom 无真实指针/焦点时序测不出）。
   * 因为我们用的是 PopoverAnchor virtualRef 而非 PopoverTrigger，Radix
   * 自带的 targetIsTrigger 豁免不生效，这里补一个短暂的豁免窗口：
   * 弹层打开后 ~300ms 内的 focus-outside 不 dismiss（足以覆盖菜单卸载的
   * 焦点回执：onCloseAutoFocus → ⋯ 按钮、onItemLeave → 菜单容器）。
   */
  const popoverOpenedAtRef = useRef(0);

  function guardPopoverFocusOutside(event: {
    target: EventTarget | null;
    preventDefault: () => void;
  }) {
    if (Date.now() - popoverOpenedAtRef.current < 300) {
      event.preventDefault();
    }
  }

  /** 行尾 `⋯` 操作菜单（task 09-01-row-actions-menu）：收编原有平铺按钮 */
  function rowMenu(
    item: T,
    {
      isParent,
      childCount,
      archived,
    }: { isParent: boolean; childCount: number; archived: boolean },
  ) {
    const archivedItem = isArchived(item);
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t(`${ns}.moreActions`)}
            ref={(el) => {
              if (el) triggerEls.current.set(item.id, el);
              else triggerEls.current.delete(item.id);
            }}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isParent && !archived ? (
            <DropdownMenuItem
              onSelect={() => {
                // 锚点在 onSelect 时读取（render 期 map 尚未挂 ref，闭包值会是 null）
                setPopoverTarget({
                  kind: "addChild",
                  item,
                  anchor: triggerEls.current.get(item.id) ?? null,
                });
                popoverOpenedAtRef.current = Date.now();
              }}
            >
              {t(`${ns}.addChild`)}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              setPopoverTarget({
                kind: "edit",
                item,
                anchor: triggerEls.current.get(item.id) ?? null,
              });
              popoverOpenedAtRef.current = Date.now();
            }}
          >
            {t(`${ns}.edit`)}
          </DropdownMenuItem>
          {archiveEnabled ? (
            archivedItem ? (
              <DropdownMenuItem
                onSelect={() =>
                  setPendingArchive(archiveTarget(item, isParent, "unarchive"))
                }
              >
                {t("categories.unarchive")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() =>
                  setPendingArchive(archiveTarget(item, isParent, "archive"))
                }
              >
                {t("categories.archive")}
              </DropdownMenuItem>
            )
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setPendingDelete({ item, childCount })}
          >
            {t(`${ns}.delete`)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderRow(
    item: T,
    {
      isParent,
      childCount,
      indent,
      archived,
    }: {
      isParent: boolean;
      childCount: number;
      indent: boolean;
      archived: boolean;
    },
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
        <span
          className={cn("flex min-w-0 items-center gap-2", indent && "pl-6")}
        >
          {indent ? (
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          ) : null}
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: paletteColor(item.color, item.name) }}
          />
          <span
            className={cn(
              "truncate",
              isParent && "font-medium",
              archived && "text-muted-foreground",
            )}
          >
            {item.name}
          </span>
          {archived ? (
            <Archive
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label={t("categories.archived")}
            />
          ) : null}
        </span>
        <span className="ml-auto pl-2 font-mono text-xs tabular-nums text-muted-foreground">
          {item.entryCount}
        </span>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100",
          )}
        >
          {popoverTarget?.item.id === item.id &&
          popoverTarget.anchor != null ? (
            popoverTarget.kind === "addChild" ? (
              <Popover
                open
                onOpenChange={(open) => {
                  if (!open) setPopoverTarget(null);
                }}
              >
                <PopoverAnchor virtualRef={anchorRef} />
                <PopoverContent
                  align="end"
                  className="w-72"
                  onFocusOutside={guardPopoverFocusOutside}
                >
                  <AddChildPopoverForm
                    namespace={ns}
                    parentName={item.name}
                    onClose={() => setPopoverTarget(null)}
                    onCreate={(childName) =>
                      props.onCreateChild(item, childName)
                    }
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Popover
                open
                onOpenChange={(open) => {
                  if (!open) setPopoverTarget(null);
                }}
              >
                <PopoverAnchor virtualRef={anchorRef} />
                <PopoverContent
                  align="end"
                  className="w-72"
                  onFocusOutside={guardPopoverFocusOutside}
                >
                  <NameColorEditPopoverForm
                    namespace={ns}
                    name={item.name}
                    color={item.color}
                    parentOptions={props.topOptions}
                    parentId={item.parentId}
                    excludeId={item.id}
                    onClose={() => setPopoverTarget(null)}
                    onSave={(next) => props.onUpdate(item, next)}
                  />
                </PopoverContent>
              </Popover>
            )
          ) : null}
          {rowMenu(item, { isParent, childCount, archived })}
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
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y">
            {activeRows.map(({ parent, children }) => (
              <Fragment key={parent.id}>
                {renderRow(parent, {
                  isParent: true,
                  childCount: children.length,
                  indent: false,
                  archived: false,
                })}
                {!collapsedIds.has(parent.id)
                  ? children.map((child) =>
                      renderRow(child, {
                        isParent: false,
                        childCount: 0,
                        indent: true,
                        archived: false,
                      }),
                    )
                  : null}
              </Fragment>
            ))}
            {archivedRows.length > 0 ? (
              <div className="bg-muted/30">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground"
                  aria-expanded={!archivedCollapsed}
                  aria-label={
                    archivedCollapsed
                      ? t("categories.expandArchived")
                      : t("categories.collapseArchived")
                  }
                  onClick={() => setArchivedCollapsed((v) => !v)}
                >
                  {archivedCollapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  <span className="font-medium">
                    {t("categories.archivedCount", { count: archivedCount })}
                  </span>
                </button>
                {!archivedCollapsed ? (
                  <div className="divide-y border-t">
                    {archivedRows.map(({ parent, children }) => (
                      <Fragment key={parent.id}>
                        {renderRow(parent, {
                          isParent: true,
                          childCount: children.length,
                          indent: false,
                          archived: true,
                        })}
                        {!collapsedIds.has(parent.id)
                          ? children.map((child) =>
                              renderRow(child, {
                                isParent: false,
                                childCount: 0,
                                indent: true,
                                archived: true,
                              }),
                            )
                          : null}
                      </Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
        title={t(`${ns}.deleteConfirmTitle`)}
        description={
          pendingDelete && pendingDelete.childCount > 0
            ? t(`${ns}.deleteCascadeDescription`, {
                count: pendingDelete.childCount,
              })
            : t(`${ns}.deleteConfirmDescription`)
        }
        confirmText={t("common.confirmDelete")}
        cancelText={t("common.cancel")}
        pending={deleting}
        destructive
        onConfirm={handleConfirmDelete}
      />
      {archiveEnabled ? (
        <ConfirmDialog
          open={pendingArchive != null}
          onOpenChange={(open) => {
            if (!open && !archiving) setPendingArchive(null);
          }}
          title={
            pendingArchive?.action === "archive"
              ? t("categories.archiveConfirmTitle")
              : t("categories.unarchiveConfirmTitle")
          }
          description={archiveDialogDescription()}
          confirmText={
            pendingArchive?.action === "archive"
              ? t("categories.archive")
              : t("categories.unarchive")
          }
          cancelText={t("common.cancel")}
          pending={archiving}
          onConfirm={handleConfirmArchive}
        />
      ) : null}
    </>
  );

  function archiveDialogDescription(): string {
    const target = pendingArchive;
    if (!target) return "";
    if (target.action === "archive") {
      return target.context.childCount > 0
        ? t("categories.archiveCascadeDescription", {
            count: target.context.childCount,
          })
        : t("categories.archiveConfirmDescription");
    }
    return target.context.archivedAncestorCount > 0
      ? t("categories.unarchiveParentCascadeDescription", {
          count: target.context.archivedAncestorCount,
        })
      : t("categories.unarchiveConfirmDescription");
  }
}
