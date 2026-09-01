import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 「添加子级」弹层内容（task 09-01-row-actions-menu 从行尾按钮收进 ⋯ 菜单）：
 * 受控表单（名称 Input），确认后以固定 parentId 创建子节点。挂载即重置草稿；
 * 外层由 HierarchicalListCard 用 Popover + PopoverAnchor 锚定 ⋯ 按钮打开。
 * namespaced keys：`{ns}.parent` / `{ns}.childName` / `{ns}.add` / `{ns}.cancel`。
 */
export function AddChildPopoverForm(props: {
  namespace: "categories" | "tags";
  parentName: string;
  /** 取消按钮回调（关闭外层 Popover；不传则隐藏语义仍由外层控制） */
  onClose?: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ns = props.namespace;

  async function create() {
    setSaving(true);
    setError("");
    try {
      await props.onCreate(name.trim());
      props.onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(`${ns}.createFailed`));
    } finally {
      setSaving(false);
    }
  }

  return (
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
          onClick={() => void create()}
        >
          {t(`${ns}.add`)}
        </Button>
      </div>
    </div>
  );
}
