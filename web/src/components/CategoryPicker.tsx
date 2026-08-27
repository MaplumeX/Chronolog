import type { Category } from "../api";
import { categoryColor } from "../format";
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
  colorName: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
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
            style={{ background: categoryColor(props.colorName) }}
          />
          {props.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {props.categories.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => props.onChange(c.id)}
            className={c.id === props.value ? "bg-accent" : undefined}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: categoryColor(c.name) }}
            />
            {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
