import {
  ChartNoAxesColumn,
  Tag,
  Tags,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { zh } from "../i18n/locales/zh";

export type PageId =
  "timer" | "stats" | "goals" | "categories" | "tags" | "settings";

/**
 * 五个主导航项（不含 settings）：桌面 sidebar 与移动端底部 Tab 栏共用。
 */
export const NAV_ITEMS: {
  id: PageId;
  labelKey: keyof typeof zh;
  icon: LucideIcon;
}[] = [
  { id: "timer", labelKey: "nav.timer", icon: Timer },
  { id: "stats", labelKey: "nav.stats", icon: ChartNoAxesColumn },
  { id: "goals", labelKey: "nav.goals", icon: Target },
  { id: "categories", labelKey: "nav.categories", icon: Tags },
  { id: "tags", labelKey: "nav.tags", icon: Tag },
];
