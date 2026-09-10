import type { Measurable } from "@radix-ui/rect";

/**
 * 固化锚点快照：记录某元素在某一刻的位置矩形，供 Radix `PopoverAnchor virtualRef` 消费。
 *
 * 用途有两类，都是「真实 DOM 节点不能当锚点」的场景：
 * 1. 行会重排 —— 点击 gap 后数据刷新导致行位置变化，popover 不应跟着移动；
 * 2. 锚点会先于 popover 卸载 —— `PopoverContent` 有退出动画（`data-[state=closed]:animate-out`），
 *    若锚点节点随 `open=false` 在同一帧消失，Radix 失去定位依据，退出动画期间会回落到
 *    视口左上角闪现一帧。快照让锚点位置在整个退出动画期间保持有效。
 */
export class RectSnapshot implements Measurable {
  constructor(private readonly rect: DOMRect) {}
  getBoundingClientRect(): DOMRect {
    return this.rect;
  }
}

/**
 * 元素中心点的零尺寸矩形。
 *
 * 等价于在元素内部挂一个 `absolute top-1/2 left-1/2 h-0 w-0` 的锚点节点，
 * 但不依赖该节点的存活——用于把真实节点锚点换成快照时保持弹出方向不变。
 */
export function centerRectOf(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  return new DOMRect(r.left + r.width / 2, r.top + r.height / 2, 0, 0);
}
