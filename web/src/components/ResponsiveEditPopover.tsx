import * as React from "react";
import type { Measurable } from "@radix-ui/rect";

import { useIsMobile } from "../hooks/use-mobile";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * 移动端/桌面端自适应编辑容器（纯容器组件，无业务逻辑）：
 *
 * - 桌面（!isMobile）：`Popover + PopoverAnchor(virtualRef) + PopoverContent`，
 *   透传锚定/定位/focus 守卫 props —— 与既有调用点的直接 Popover 写法等价。
 *   `anchor` 缺省时不渲染 PopoverAnchor（此时 PopoverContent 需自带
 *   PopoverTrigger，或如 Timeline 那样由外部在 Root 内挂零尺寸锚点）。
 * - 移动（isMobile）：`Sheet + SheetContent side="bottom"`，全宽底部弹层，
 *   顶部 drag handle 视觉条 + sr-only SheetTitle（Radix a11y 要求），
 *   内容区 `max-h-[85dvh]` 内滚，底部 `env(safe-area-inset-bottom)` 安全区。
 *   `anchor` / `side` / `align` / `sideOffset` / `contentClassName` /
 *   `onFocusOutside` 在移动端被忽略（Sheet 是 modal，Radix Dialog 自管 focus）。
 *
 * `rootChildren`：页面主体内容（两种模式都渲染，不是弹层的一部分）。
 * 典型调用方 Timeline：主体内的选中卡 / gap 行渲染 `PopoverAnchor`（定位锚点），
 * Radix Anchor 无 Popover Root 时会抛错 —— 桌面分支把 rootChildren 放进 Popover Root 内
 * （Root 是纯 context，无 DOM 包裹）；移动分支放进一个 `open={false}` 的空 Popover Root
 * （只为 Anchor 提供 context，closed Root 无任何副作用）。不传 rootChildren 的调用方不受影响。
 */
export function ResponsiveEditPopover(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 桌面端锚定（virtualRef 形态 RefObject）— 移动端忽略。
   *  `Measurable` 而非 `HTMLElement`：Radix 只要求 `getBoundingClientRect()`，
   *  真实节点与 `RectSnapshot`（`rect-snapshot.ts`）均可传入。 */
  anchor?: React.RefObject<Measurable | null>;
  /** 桌面端 popover 定位参数，移动端忽略 */
  side?: "right" | "top" | "bottom" | "left";
  align?: "center" | "start" | "end";
  sideOffset?: number;
  /** 桌面端 popover 宽度等 class（如 "w-80"、"w-72"），移动端忽略 */
  contentClassName?: string;
  /** 桌面端 focus 守卫（如 HierarchicalListCard 的 300ms grace）— 移动端忽略；
   *  与 Radix FocusOutsideEvent 结构兼容（参考 HierarchicalListCard 守卫签名） */
  onFocusOutside?: (event: {
    target: EventTarget | null;
    preventDefault: () => void;
  }) => void;
  /** Sheet 语义标题（sr-only SheetTitle） */
  srTitle: string;
  /** 弹层内容（桌面进 PopoverContent / 移动进 SheetContent） */
  children: React.ReactNode;
  /** 页面主体内容：桌面渲染在 Popover Root 内（供主体内 PopoverAnchor 定位），
   *  移动渲染在空 Popover Root 内（Radix Anchor 无 Root 会抛错，closed Root 无副作用）。
   *  两端都不是弹层的一部分，始终随组件渲染。 */
  rootChildren?: React.ReactNode;
}) {
  const {
    open,
    onOpenChange,
    anchor,
    // 默认 bottom 与 Radix PopoverContent 原生默认一致：未显式传 side 的调用方
    // （如 HierarchicalListCard）保持替换前的原生默认行为，避免桌面回归
    side = "bottom",
    align = "center",
    sideOffset = 4,
    contentClassName,
    onFocusOutside,
    srTitle,
    children,
    rootChildren,
  } = props;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {/* 空 Popover Root：仅为 rootChildren 内的 PopoverAnchor（选中卡零尺寸锚点、
            gap 行 virtualRef 锚点）提供 context，closed Root 无任何副作用 */}
        {rootChildren != null ? (
          <Popover open={false} onOpenChange={() => {}}>
            {rootChildren}
          </Popover>
        ) : null}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            // 不自动聚焦第一个可聚焦元素（如条目编辑器的描述输入框）：
            // 避免弹层一打开就抢焦点/拉起软键盘，焦点留在原处由用户自主点击
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="max-h-[85dvh] gap-0 pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{srTitle}</SheetTitle>
            </SheetHeader>
            <div
              aria-hidden="true"
              className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchor ? <PopoverAnchor virtualRef={anchor} /> : null}
      {rootChildren}
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName}
        onFocusOutside={onFocusOutside}
        // 同 Sheet：阻止打开时自动聚焦，输入框不抢焦点
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
