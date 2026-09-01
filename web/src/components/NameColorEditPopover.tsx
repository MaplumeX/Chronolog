import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ColorPalettePicker } from "./ColorPalettePicker";
import { categoryIndex, paletteColor } from "../format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 分类/标签「编辑」弹层内容（task 09-01-row-actions-menu 从行尾按钮收进 ⋯ 菜单）：
 * 名称 Input + 8 色色板，保存时 name+color 一次提交（挂载即从 item 重置草稿）。
 * 颜色创建即固定（无「自动」）；存量 NULL 回退名称 hash 色，保存时固化落库。
 * 改名不影响色板选中态（颜色不随名称重新 hash）。
 * 外层由 HierarchicalListCard 用 Popover + PopoverAnchor 锚定 ⋯ 按钮打开。
 * namespaced keys：`{ns}.name` / `{ns}.color` / `{ns}.save` / `{ns}.cancel` / `{ns}.editFailed`。
 * 两级层级（task 08-30-hierarchical-categories-tags）：传入 `parentOptions` 后额外支持
 * 「所属父级」选择（无 / 各顶层节点，不含自身），保存时 parentId 一并提交；未传则保持原行为。
 */
export function NameColorEditPopoverForm(props: {
  namespace: "categories" | "tags";
  name: string;
  color: number | null;
  parentOptions?: {
    id: string;
    name: string;
    color: number | null;
    parentId: string | null;
  }[];
  parentId?: string | null;
  excludeId?: string;
  /** 取消按钮回调（关闭外层 Popover；不传则隐藏语义仍由外层控制） */
  onClose?: () => void;
  onSave: (next: {
    name: string;
    color: number;
    parentId: string | null;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(props.name);
  const [color, setColor] = useState<number>(
    initialColor(props.color, props.name),
  );
  const [parentId, setParentId] = useState<string | null>(
    props.parentId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ns = props.namespace;
  const selectableParents = (props.parentOptions ?? []).filter(
    (x) => x.id !== props.excludeId,
  );
  const parentName = selectableParents.find((x) => x.id === parentId)?.name;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await props.onSave({ name: name.trim(), color, parentId });
      props.onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(`${ns}.editFailed`));
    } finally {
      setSaving(false);
    }
  }

  return (
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
        <ColorPalettePicker
          value={color}
          onChange={setColor}
          label={t(`${ns}.color`)}
        />
      </div>
      {props.parentOptions ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t(`${ns}.parent`)}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start font-normal"
              >
                {parentId && parentName ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        background: paletteColor(
                          selectableParents.find((x) => x.id === parentId)
                            ?.color ?? null,
                          parentName,
                        ),
                      }}
                    />
                    {parentName}
                  </span>
                ) : (
                  t(`${ns}.topLevel`)
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setParentId(null)}
                className={parentId === null ? "bg-accent" : undefined}
              >
                {t(`${ns}.topLevel`)}
              </DropdownMenuItem>
              {selectableParents.map((x) => (
                <DropdownMenuItem
                  key={x.id}
                  onClick={() => setParentId(x.id)}
                  className={x.id === parentId ? "bg-accent" : undefined}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: paletteColor(x.color, x.name) }}
                  />
                  {x.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => props.onClose?.()}
        >
          {t(`${ns}.cancel`)}
        </Button>
        <Button
          type="button"
          disabled={!name.trim() || saving}
          onClick={() => void save()}
        >
          {t(`${ns}.save`)}
        </Button>
      </div>
    </div>
  );
}

/** 落库颜色优先；存量 NULL（自动）回退名称 hash 色（categoryIndex + 1，1–8）。 */
function initialColor(color: number | null, name: string): number {
  return color != null && color >= 1 && color <= 8
    ? color
    : categoryIndex(name) + 1;
}
