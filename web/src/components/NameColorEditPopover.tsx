import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ColorPalettePicker } from "./ColorPalettePicker";
import { categoryIndex } from "../format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * 分类/标签「编辑」浮窗（task 08-30-category-tag-color-palette）：
 * 行内触发按钮 + Popover（名称 Input + 8 色色板），保存时 name+color 一次提交。
 * 颜色创建即固定（无「自动」）；打开时草稿颜色 = item.color，存量 NULL 回退名称 hash 色，
 * 保存时固化落库。改名不影响色板选中态（颜色不随名称重新 hash）。
 * namespaced keys：`{ns}.edit` / `{ns}.name` / `{ns}.color` / `{ns}.save` / `{ns}.cancel` / `{ns}.editFailed`。
 */
export function NameColorEditPopover(props: {
  namespace: "categories" | "tags";
  name: string;
  color: number | null;
  onSave: (next: { name: string; color: number }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.name);
  const [color, setColor] = useState<number>(initialColor(props.color, props.name));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ns = props.namespace;

  function openFor() {
    setName(props.name);
    setColor(initialColor(props.color, props.name));
    setError("");
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await props.onSave({ name: name.trim(), color });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(`${ns}.editFailed`));
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
        <Button type="button" variant="outline" size="sm">
          {t(`${ns}.edit`)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${ns}-edit-name`}>{t(`${ns}.name`)}</Label>
            <Input
              id={`${ns}-edit-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void save();
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t(`${ns}.color`)}</Label>
            <ColorPalettePicker value={color} onChange={setColor} label={t(`${ns}.color`)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t(`${ns}.cancel`)}
            </Button>
            <Button type="button" disabled={!name.trim() || saving} onClick={() => void save()}>
              {t(`${ns}.save`)}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** 落库颜色优先；存量 NULL（自动）回退名称 hash 色（categoryIndex + 1，1–8）。 */
function initialColor(color: number | null, name: string): number {
  return color != null && color >= 1 && color <= 8 ? color : categoryIndex(name) + 1;
}
