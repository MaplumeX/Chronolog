import { useTranslation } from "react-i18next";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: ThemeMode; labelKey: "theme.light" | "theme.dark" | "theme.system"; icon: typeof Sun }[] = [
  { value: "light", labelKey: "theme.light", icon: Sun },
  { value: "dark", labelKey: "theme.dark", icon: Moon },
  { value: "system", labelKey: "theme.system", icon: Monitor },
];

export function ThemeSwitcher(props: {
  mode: ThemeMode;
  onMode: (mode: ThemeMode) => void;
}) {
  const { t } = useTranslation();
  const current = OPTIONS.find((o) => o.value === props.mode) ?? OPTIONS[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 overflow-hidden"
        >
          <current.icon />
          <span className="truncate">{t(current.labelKey)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => props.onMode(o.value)}>
            <o.icon />
            <span>{t(o.labelKey)}</span>
            {o.value === props.mode ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
