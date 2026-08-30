import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  api,
  type Category,
  type Goal,
  type GoalInput,
  type Tag,
} from "../api";
import { browserTz, formatDuration } from "../format";
import { GoalEditorDialog } from "@/components/GoalEditorDialog";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** lt 型目标在当前窗口超限（active 但 current ≥ target）时前端渲染“已超限”警示色 */
function isExceeded(goal: Goal): boolean {
  return (
    goal.status === "active" &&
    goal.direction === "lt" &&
    goal.progress.currentSeconds != null &&
    goal.progress.currentSeconds >= goal.progress.targetSeconds
  );
}

export function GoalsPage() {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function reload() {
    const tz = browserTz();
    const res = await api.goals(tz);
    setGoals(res.goals);
  }

  useEffect(() => {
    reload()
      .then(() => setLoaded(true))
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : t("common.loadFailed"),
        ),
      );
    api
      .categories()
      .then((r) => setCategories(r.categories))
      .catch(() => undefined);
    api
      .tags()
      .then((r) => setTags(r.tags))
      .catch(() => undefined);
    // 简单 30s 轮询刷新进度
    const id = setInterval(() => {
      reload().catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setEditorOpen(true);
  }

  async function submit(input: GoalInput) {
    setError("");
    try {
      if (editing) {
        await api.updateGoal(editing.id, input);
      } else {
        await api.createGoal(input);
      }
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(editing ? "goals.editFailed" : "goals.createFailed"));
      throw err;
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.deleteGoal(id);
      setConfirming(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("goals.deleteFailed"));
    }
  }

  const sorted = [...goals].sort((a, b) => {
    // expired 置灰排末尾，其余在前；组内按 createdAt（后端已按 createdAt 排序，稳定排序即可）
    const ae = a.status === "expired" ? 1 : 0;
    const be = b.status === "expired" ? 1 : 0;
    if (ae !== be) return ae - be;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });

  function matchSummary(goal: Goal): string {
    const categoryName = goal.categoryId
      ? (categories.find((c) => c.id === goal.categoryId)?.name ??
        goal.categoryId)
      : null;
    const tagName = goal.tagId
      ? (tags.find((tag) => tag.id === goal.tagId)?.name ?? goal.tagId)
      : null;
    if (categoryName && tagName)
      return t("goals.match.both", { category: categoryName, tag: tagName });
    if (categoryName) return t("goals.match.category", { name: categoryName });
    if (tagName) return t("goals.match.tag", { name: tagName });
    return t("goals.matchAll");
  }

  return (
    <PageContainer size="wide">
      <div className="mb-4 flex">
        <Button type="button" className="ml-auto" onClick={openCreate}>
          {t("goals.new")}
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {loaded && goals.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("goals.empty")}
        </p>
      ) : null}

      {goals.length > 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("goals.name")}</TableHead>
              <TableHead>{t("goals.category")}</TableHead>
              <TableHead>{t("goals.direction")}</TableHead>
              <TableHead>{t("goals.statusLabel")}</TableHead>
              <TableHead className="w-[240px]">
                {t("goals.progressLabel")}
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((goal) => {
              const expired = goal.status === "expired";
              const exceeded = isExceeded(goal);
              const current = goal.progress.currentSeconds;
              const target = goal.progress.targetSeconds;
              const pct =
                current != null && target > 0
                  ? Math.min(100, (current / target) * 100)
                  : 0;
              return (
                <TableRow
                  key={goal.id}
                  className={expired ? "opacity-50" : undefined}
                >
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{goal.icon}</span>
                      <span className="font-medium">{goal.name}</span>
                      {goal.dueDate ? (
                        <span className="text-xs text-muted-foreground">
                          {expired
                            ? t("goals.expired")
                            : t("goals.due", { date: goal.dueDate })}
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {matchSummary(goal)}
                  </TableCell>
                  <TableCell>
                    {t("goals.condition", {
                      period: t(`goals.period.${goal.periodUnit}`),
                      direction: t(`goals.direction.${goal.direction}`),
                      hours: goal.hours,
                    })}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                        (expired
                          ? "bg-muted text-muted-foreground"
                          : goal.status === "achieved"
                            ? "bg-primary/10 text-primary"
                            : exceeded
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground")
                      }
                    >
                      {expired
                        ? t("goals.expired")
                        : goal.status === "achieved"
                          ? t("goals.status.achieved")
                          : exceeded
                            ? t("goals.exceeded")
                            : t("goals.status.active")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {current != null ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-28 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={
                              "h-full " +
                              (exceeded
                                ? "bg-destructive"
                                : goal.status === "achieved"
                                  ? "bg-primary"
                                  : "bg-primary/60")
                            }
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatDuration(current)} / {formatDuration(target)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(goal)}
                      >
                        {t("goals.edit")}
                      </Button>
                      {confirming === goal.id ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void remove(goal.id)}
                        >
                          {t("goals.confirmDelete")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirming(goal.id)}
                        >
                          {t("goals.delete")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <GoalEditorDialog
        open={editorOpen}
        goal={editing}
        categories={categories}
        tags={tags}
        onOpenChange={setEditorOpen}
        onSubmit={submit}
      />
    </PageContainer>
  );
}
