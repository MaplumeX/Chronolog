import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * 内置色板单选（task 08-30-palette-auto-to-fixed）：
 * 8 个色点必选其一，无「自动」选项——颜色在创建时即按名称 hash 固定落库。
 * 色点底色只用 `var(--category-N)` token（design-tokens：不写裸色值）。
 */
export function ColorPalettePicker(props: {
  /** 当前选中色板索引（1–8），必有确定值 */
  value: number;
  onChange: (color: number) => void;
  /** a11y 描述，如 “分类颜色” */
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={props.label} className="flex flex-wrap items-center gap-2">
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={props.value === n}
          title={`${t("common.color")} ${n}`}
          onClick={() => props.onChange(n)}
          className={cn(
            "size-6 rounded-full outline-offset-2 transition-shadow",
            props.value === n
              ? "outline-2 outline-ring"
              : "hover:outline-1 hover:outline-muted-foreground",
          )}
          style={{ background: `var(--category-${n})` }}
        />
      ))}
    </div>
  );
}
