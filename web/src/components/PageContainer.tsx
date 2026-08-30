import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * 页面内容居中限宽容器：default=表单/设置类（max-w-3xl），
 * wide=表格/统计类（max-w-5xl），full=时间线等横向视图（不限宽）。
 */
export function PageContainer(props: {
  size?: "default" | "wide" | "full"
  className?: string
  children: ReactNode
}) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto w-full p-4 md:p-6",
        props.size === "wide"
          ? "max-w-5xl"
          : props.size === "full"
            ? "max-w-none"
            : "max-w-3xl",
        props.className
      )}
    >
      {props.children}
    </div>
  )
}
