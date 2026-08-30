import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * 「添加子级」浮窗（task 08-30-hierarchical-categories-tags）：
 * 行内触发按钮 + Popover（名称 Input），确认后以固定 parentId 创建子节点。
 * namespaced keys：`{ns}.addChild` / `{ns}.parent` / `{ns}.childName` / `{ns}.add` / `{ns}.cancel`。
 */
export function AddChildPopover(props: {
  namespace: "categories" | "tags";
  parentName: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ns = props.namespace;

  function openFor() {
    setName("");
    setError("");
    setOpen(true);
  }

  async function create() {
    setSaving(true);
    setError("");
    try {
      await props.onCreate(name.trim());
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(`${ns}.createFailed`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) openFor();
        else setOpen(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          {t(`${ns}.addChild`)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t(`${ns}.parent`)}：{props.parentName}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${ns}-child-name`}>{t(`${ns}.childName`)}</Label>
            <Input
              id={`${ns}-child-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void create();
              }}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t(`${ns}.cancel`)}
            </Button>
            <Button type="button" disabled={!name.trim() || saving} onClick={() => void create()}>
              {t(`${ns}.add`)}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
