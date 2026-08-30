import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * 内置色板单选（task 08-30-category-tag-color-palette）：
 * 8 个色点 + 「自动」（null = 未指定，回退名称 hash 色）。
 * 色点底色只用 `var(--category-N)` token（design-tokens：不写裸色值）。
 */
export function ColorPalettePicker(props: {
  /** 当前选中色板索引（1–8）；null = 自动 */
  value: number | null;
  onChange: (color: number | null) => void;
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
          onClick={() => props.onChange(props.value === n ? null : n)}
          className={cn(
            "size-6 rounded-full outline-offset-2 transition-shadow",
            props.value === n
              ? "outline-2 outline-ring"
              : "hover:outline-1 hover:outline-muted-foreground",
          )}
          style={{ background: `var(--category-${n})` }}
        />
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={props.value === null}
        onClick={() => props.onChange(null)}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs transition-colors",
          props.value === null
            ? "border-ring bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent",
        )}
      >
        {t("common.colorAuto")}
      </button>
    </div>
  );
}
