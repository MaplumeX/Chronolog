import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Tag } from "../api";
import { paletteColor } from "../format";
import { sortHierarchical } from "../hierarchy";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TagPicker(props: {
  tags: Tag[];
  value: string[];
  label: string;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();

  function toggle(id: string) {
    if (props.value.includes(id)) {
      props.onChange(props.value.filter((x) => x !== id));
    } else {
      props.onChange([...props.value, id]);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={props.disabled}
          className="w-full shrink-0 justify-start gap-2 rounded-lg md:ml-auto md:w-auto"
        >
          {props.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {props.tags.length === 0 ? (
          <DropdownMenuItem disabled>{t("tags.empty")}</DropdownMenuItem>
        ) : (
          sortHierarchical(props.tags).map(({ parent, children }) => (
            <div key={parent.id}>
              <DropdownMenuItem
                onClick={() => toggle(parent.id)}
                className={props.value.includes(parent.id) ? "bg-accent" : undefined}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: paletteColor(parent.color, parent.name) }}
                />
                <span className="font-medium">{parent.name}</span>
                {props.value.includes(parent.id) ? <Check className="ml-auto size-4" /> : null}
              </DropdownMenuItem>
              {children.map((tag) => {
                const selected = props.value.includes(tag.id);
                return (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    className={`${selected ? "bg-accent" : ""} pl-7 text-muted-foreground`}
                  >
                    <span className="ml-2 h-3 w-px shrink-0 bg-border" aria-hidden="true" />
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: paletteColor(tag.color, tag.name) }}
                    />
                    {tag.name}
                    {selected ? <Check className="ml-auto size-4" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
