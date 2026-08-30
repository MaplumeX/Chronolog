import type { Category } from "../api";
import { paletteColor } from "../format";
import { sortHierarchical } from "../hierarchy";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CategoryPicker(props: {
  categories: Category[];
  value: string;
  label: string;
  /** 选中分类的名称（无选中时传空串），未显式设色时按名称 hash 回退 */
  colorName: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const selected = props.categories.find((c) => c.id === props.value);
  const color = selected
    ? paletteColor(selected.color, selected.name)
    : paletteColor(null, props.colorName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={props.disabled}
          className="w-full shrink-0 justify-start gap-2 rounded-lg md:w-auto"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden="true"
          />
          {props.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {sortHierarchical(props.categories).map(({ parent, children }) => (
          <div key={parent.id}>
            <DropdownMenuItem
              onClick={() => props.onChange(parent.id)}
              className={parent.id === props.value ? "bg-accent" : undefined}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: paletteColor(parent.color, parent.name) }}
                aria-hidden="true"
              />
              <span className="font-medium">{parent.name}</span>
            </DropdownMenuItem>
            {children.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => props.onChange(c.id)}
                className={`${c.id === props.value ? "bg-accent" : ""} pl-7 text-muted-foreground`}
              >
                <span
                  className="ml-2 h-3 w-px shrink-0 bg-border"
                  aria-hidden="true"
                />
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: paletteColor(c.color, c.name) }}
                  aria-hidden="true"
                />
                {c.name}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
