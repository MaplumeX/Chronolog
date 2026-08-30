import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "lucide-react";
import type { Category, Goal, GoalInput, Tag } from "../api";
import { paletteColor } from "../format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** 常用 emoji，分主题；不做白名单校验（后端仅限长度），选择器只负责引导 */
const EMOJI_GROUPS: string[][] = [
  ["🎯", "💼", "📈", "📊", "💻", "📝", "📅", "⏰", "📌", "✅", "⚡", "🏆"],
  ["📚", "🎓", "✏️", "📖", "🧠", "🔬", "🧪", "🧩", "💡", "🗂️", "🔤", "🗒️"],
  ["💪", "🏃", "🧘", "💤", "🍎", "🥗", "🚴", "🏊", "🧹", "🛏️", "🪴", "☕"],
  ["🎮", "🎵", "🎬", "🎨", "🎸", "♟️", "🐱", "🌊", "✈️", "🏔️", "🌙", "⭐"],
];

const EMOJIS = EMOJI_GROUPS.flat();
const DEFAULT_ICON = "🎯";

export function GoalEditorDialog(props: {
  open: boolean;
  /** null = 新建 */
  goal: Goal | null;
  categories: Category[];
  tags: Tag[];
  onOpenChange: (open: boolean) => void;
  /** 提交（已通过本地校验）；失败时抛出由调用方处理 */
  onSubmit: (input: GoalInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"lt" | "gt">("gt");
  const [hours, setHours] = useState("1");
  const [periodUnit, setPeriodUnit] = useState<"day" | "week" | "month">("day");
  const [dueDate, setDueDate] = useState("");
  const [validation, setValidation] = useState("");
  const [saving, setSaving] = useState(false);

  // 打开时按 goal（编辑）或默认值（新建）初始化表单
  useEffect(() => {
    if (!props.open) return;
    setValidation("");
    setSaving(false);
    if (props.goal) {
      setName(props.goal.name);
      setIcon(props.goal.icon);
      setCategoryId(props.goal.categoryId);
      setTagId(props.goal.tagId);
      setDirection(props.goal.direction);
      setHours(String(props.goal.hours));
      setPeriodUnit(props.goal.periodUnit);
      setDueDate(props.goal.dueDate ?? "");
    } else {
      setName("");
      setIcon(DEFAULT_ICON);
      setCategoryId(null);
      setTagId(null);
      setDirection("gt");
      setHours("1");
      setPeriodUnit("day");
      setDueDate("");
    }
  }, [props.open, props.goal]);

  const hoursNum = Number(hours);
  const valid =
    name.trim().length > 0 && Number.isFinite(hoursNum) && hoursNum > 0;

  async function submit() {
    if (!valid) {
      setValidation(
        name.trim().length === 0
          ? t("goals.nameRequired")
          : t("goals.hoursRequired"),
      );
      return;
    }
    setValidation("");
    setSaving(true);
    try {
      await props.onSubmit({
        name: name.trim(),
        icon,
        categoryId,
        tagId,
        direction,
        hours: hoursNum,
        periodUnit,
        dueDate: dueDate || null,
      });
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedCategory = props.categories.find((c) => c.id === categoryId);
  const selectedTag = props.tags.find((tag) => tag.id === tagId);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.goal ? t("goals.edit") : t("goals.new")}
          </DialogTitle>
          <DialogDescription>{t("goals.title")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal-name">{t("goals.name")}</Label>
            <Input
              id="goal-name"
              value={name}
              maxLength={32}
              placeholder={t("goals.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("goals.icon")}</Label>
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={icon === e}
                  className={
                    "flex h-9 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent " +
                    (icon === e ? "bg-accent ring-2 ring-primary" : "")
                  }
                  onClick={() => setIcon(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("goals.category")}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-lg"
                  >
                    {selectedCategory ? (
                      <>
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            background: paletteColor(
                              selectedCategory.color,
                              selectedCategory.name,
                            ),
                          }}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {selectedCategory.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("goals.anyCategory")}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-64 overflow-y-auto"
                >
                  <DropdownMenuItem onClick={() => setCategoryId(null)}>
                    {t("goals.anyCategory")}
                  </DropdownMenuItem>
                  {props.categories.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      className={c.id === categoryId ? "bg-accent" : undefined}
                      onClick={() => setCategoryId(c.id)}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: paletteColor(c.color, c.name) }}
                        aria-hidden="true"
                      />
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="grid gap-2">
              <Label>{t("goals.tag")}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start rounded-lg"
                  >
                    {selectedTag ? (
                      <span className="truncate">{selectedTag.name}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("goals.anyTag")}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-64 overflow-y-auto"
                >
                  <DropdownMenuItem onClick={() => setTagId(null)}>
                    {t("goals.anyTag")}
                  </DropdownMenuItem>
                  {props.tags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      className={tag.id === tagId ? "bg-accent" : undefined}
                      onClick={() => setTagId(tag.id)}
                    >
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>{t("goals.direction")}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between rounded-lg font-normal"
                  >
                    <span>{t(`goals.direction.${direction}`)}</span>
                    <ChevronDownIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(["lt", "gt"] as const).map((d) => (
                    <DropdownMenuItem
                      key={d}
                      className={direction === d ? "bg-accent" : undefined}
                      onClick={() => setDirection(d)}
                    >
                      {t(`goals.direction.${d}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-hours">{t("goals.hours")}</Label>
              <Input
                id="goal-hours"
                type="number"
                min={0.5}
                max={1000}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("goals.periodUnit")}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between rounded-lg font-normal"
                  >
                    <span>{t(`goals.period.${periodUnit}`)}</span>
                    <ChevronDownIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(["day", "week", "month"] as const).map((u) => (
                    <DropdownMenuItem
                      key={u}
                      className={periodUnit === u ? "bg-accent" : undefined}
                      onClick={() => setPeriodUnit(u)}
                    >
                      {t(`goals.period.${u}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-due">{t("goals.dueDate")}</Label>
            <Input
              id="goal-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {validation ? (
            <p className="text-sm text-destructive">{validation}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
          >
            {t("goals.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!valid || saving}
            onClick={() => void submit()}
          >
            {t("goals.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
