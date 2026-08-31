import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Category } from "../api";
import { categoryIndex } from "../format";
import { topLevel } from "../hierarchy";
import { HierarchicalListCard } from "@/components/HierarchicalListCard";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const res = await api.categories();
    setCategories(res.categories);
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
  }, []);

  async function create() {
    setError("");
    try {
      await api.createCategory(name.trim(), categoryIndex(name.trim()) + 1);
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("categories.createFailed"));
    }
  }

  async function createChild(parent: Category, childName: string) {
    setError("");
    await api.createCategory(childName, categoryIndex(childName) + 1, parent.id);
    await reload();
  }

  async function update(
    c: Category,
    next: { name: string; color: number; parentId: string | null },
  ) {
    await api.updateCategory(c.id, next);
    await reload();
  }

  async function remove(c: Category) {
    setError("");
    try {
      await api.deleteCategory(c.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("categories.deleteFailed"));
    }
  }

  const topOptions = topLevel(categories);

  return (
    <PageContainer size="wide">
      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          placeholder={t("categories.newNamePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
        />
        <Button type="button" variant="outline" onClick={() => void create()} disabled={!name.trim()}>
          {t("categories.add")}
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <HierarchicalListCard
        namespace="categories"
        items={categories}
        topOptions={topOptions}
        onCreateChild={createChild}
        onUpdate={update}
        onDelete={remove}
        deleteDisabled={(c) => c.entryCount > 0}
      />
    </PageContainer>
  );
}
