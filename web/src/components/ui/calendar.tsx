import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { Button, buttonVariants as ButtonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--rdp-accent-color:var(--primary)] [--rdp-accent-background-color:var(--accent)] [--rdp-day-height:2.25rem] [--rdp-day-width:2.25rem] [--rdp-day_button-height:2rem] [--rdp-day_button-width:2rem] [--rdp-caption_label-font-size:0.875rem] [--rdp-chevron-height:1rem] [--rdp-day-font-size:0.875rem] [--rdp-dropdown-gap:0.5rem] [--rdp-months-gap:1rem] [--rdp-nav_button-height:2rem] [--rdp-nav_button-width:2rem] [--rdp-nav-height:2.75rem] [--rdp-selected-border:1px solid var(--border)] [--rdp-selected-font:inherit] [--rdp-today-color:var(--primary)] [--rdp-week_number-opacity:0.5] [--rdp-weekday-font-size:0.75rem] [--rdp-weekday-opacity:1] [--rdp-weekday-padding:0 0.5rem] [--rdp-weeknumber-font-size:0.75rem] [--rdp-outside-opacity:50%]",
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (month) => month.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex", defaultClassNames.months),
        month: cn("flex flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          ButtonVariants({ variant: "outline" }),
          "size-(--rdp-nav_button-height) select-none aria-disabled:pointer-events-none aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          ButtonVariants({ variant: "outline" }),
          "size-(--rdp-nav_button-height) select-none aria-disabled:pointer-events-none aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--rdp-nav-height) w-full items-center justify-center px-8",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--rdp-nav-height) w-full items-center justify-center gap-1 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-ring/50 has-focus:ring-[3px]",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium text-sm",
          captionLayout === "label"
            ? "[&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:text-sm [&>span]:font-medium"
            : "flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm font-medium [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:font-medium [&>svg]:size-3.5 [&>svg]:opacity-50",
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 select-none rounded-foreground/60 text-[0.75rem] font-normal text-muted-foreground",
          defaultClassNames.weekday,
        ),
        week: cn("mt-0.5 flex w-full", defaultClassNames.week),
        week_number: cn(
          "select-none text-[0.75rem] text-muted-foreground",
          defaultClassNames.week_number,
        ),
        day: cn(
          "relative w-full flex-1 text-center text-sm",
          defaultClassNames.day,
        ),
        day_button: cn(
          ButtonVariants({ variant: "ghost" }),
          "size-auto flex-1 select-none font-normal leading-none aria-selected:opacity-100",
          defaultClassNames.day_button,
        ),
        range_start: cn("rounded-l-md bg-accent", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        selected: cn(
          "rounded-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
          defaultClassNames.selected,
        ),
        today: cn("[&>button]:text-primary [&>button]:font-normal", defaultClassNames.today),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === "left") {
            return <ChevronLeftIcon className="size-4" />
          }
          if (props.orientation === "right") {
            return <ChevronRightIcon className="size-4" />
          }
          return props.orientation === "up" ? (
            <ChevronUpIcon className="size-4" />
          ) : (
            <ChevronDownIcon className="size-4" />
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

export { Calendar }