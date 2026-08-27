import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Tag } from "../api";
import { categoryColor } from "../format";
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
          className="w-full shrink-0 justify-start gap-2 rounded-lg md:w-auto"
        >
          {props.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {props.tags.length === 0 ? (
          <DropdownMenuItem disabled>{t("tags.empty")}</DropdownMenuItem>
        ) : (
          props.tags.map((tag) => {
            const selected = props.value.includes(tag.id);
            return (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => toggle(tag.id)}
                className={selected ? "bg-accent" : undefined}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: categoryColor(tag.name) }}
                />
                {tag.name}
                {selected ? <Check className="ml-auto size-4" /> : null}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
