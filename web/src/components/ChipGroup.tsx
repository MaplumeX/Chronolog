import type { CSSProperties } from "react";
import { Archive } from "lucide-react";
import { paletteColor, paletteForegroundColor } from "../format";

/** 胶囊最小数据形状（分类 / 标签共用）；color = 1–8 色板索引，null 按 name hash 回退 */
export type ChipItem = {
  id: string;
  name: string;
  color: number | null;
};

/**
 * 分类 / 标签胶囊的唯一渲染基元（任务 09-10-chip-pickers）。
 *
 * 纯展示组件：不 import `api`、不含 `t()`（文案由调用方传入），与 ConfirmDialog 同契约。
 * 刻意不区分单选 / 多选 —— 只接收 `selectedIds` + `onSelect(id)`，
 * 替换 / toggle 语义由领域层（CategoryPicker / TagPicker）实现。
 * `expandedParentId` 亦为受控，让「选中子级时父级默认展开」的派生逻辑留在领域层。
 */
export function ChipGroup(props: {
  /** 两段式数据：与 sortHierarchical() 的 { parent, children }[] 同构 */
  groups: { parent: ChipItem; children: ChipItem[] }[];
  /** 选中集合（单选传 0/1 个元素，多选传 N 个） */
  selectedIds: string[];
  /** 视觉变体：分类=实心填充，标签=描边（D1） */
  variant: "solid" | "outline";
  /** 当前展开的父级 id；null = 全部收起 */
  expandedParentId: string | null;
  onExpandChange: (parentId: string | null) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** 只读尾随胶囊（D7，归档 / 无匹配的当前值）；null / undefined = 不渲染 */
  readonlyChip?: { name: string } | null;
  /** 引导脉冲（D8）：true 时容器带有限时长脉冲动画 */
  hinted?: boolean;
  /** 空态文案（无候选且无只读胶囊时展示） */
  emptyText?: string;
}) {
  const selected = new Set(props.selectedIds);
  const expanded = props.groups.find((g) => g.parent.id === props.expandedParentId);
  const isEmpty = props.groups.length === 0 && props.readonlyChip == null;

  /** 分类色经内联 CSS 变量注入；底色规则留在 CSS（内联 background 会阻断 hover / 选中态覆盖） */
  function chipStyle(item: ChipItem): CSSProperties {
    return {
      "--chip-color": paletteColor(item.color, item.name),
      "--chip-foreground": paletteForegroundColor(item.color, item.name),
    } as CSSProperties;
  }

  function renderChip(item: ChipItem) {
    return (
      <button
        key={item.id}
        type="button"
        className={`chip chip--${props.variant}`}
        style={chipStyle(item)}
        aria-pressed={selected.has(item.id)}
        disabled={props.disabled}
        onClick={() => props.onSelect(item.id)}
      >
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: paletteColor(item.color, item.name) }}
          aria-hidden="true"
        />
        {item.name}
      </button>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5${props.hinted ? " chip-group--hinted" : ""}`}>
      {isEmpty && props.emptyText ? (
        <span className="text-xs text-muted-foreground">{props.emptyText}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {props.groups.map(({ parent, children }) => (
          <button
            key={parent.id}
            type="button"
            className={`chip chip--${props.variant}`}
            style={chipStyle(parent)}
            aria-pressed={selected.has(parent.id)}
            aria-expanded={children.length > 0 ? parent.id === props.expandedParentId : undefined}
            disabled={props.disabled}
            onClick={() => {
              props.onSelect(parent.id);
              // 点父级 = 选中 + 展开其子级行（同时最多一个展开，手风琴语义）；
              // 无子级的父级收起当前展开行——否则会残留一段属于「另一个、且已不再选中的」
              // 父级的子级行（AC2：点另一个父级时前一个的子级行收起）
              props.onExpandChange(children.length > 0 ? parent.id : null);
            }}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: paletteColor(parent.color, parent.name) }}
              aria-hidden="true"
            />
            {parent.name}
          </button>
        ))}
        {props.readonlyChip ? (
          <button
            type="button"
            className={`chip chip--${props.variant} chip--readonly`}
            aria-pressed
            aria-disabled
            disabled
          >
            <Archive className="size-3 shrink-0" aria-hidden="true" />
            {props.readonlyChip.name}
          </button>
        ) : null}
      </div>
      {expanded && expanded.children.length > 0 ? (
        <div className="chip-children flex flex-wrap items-center gap-1.5">
          {expanded.children.map(renderChip)}
        </div>
      ) : null}
    </div>
  );
}
