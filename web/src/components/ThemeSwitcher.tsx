import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "明亮", icon: Sun },
  { value: "dark", label: "暗色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];

export function ThemeSwitcher(props: {
  mode: ThemeMode;
  onMode: (mode: ThemeMode) => void;
}) {
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
          <span className="truncate">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => props.onMode(o.value)}>
            <o.icon />
            <span>{o.label}</span>
            {o.value === props.mode ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
