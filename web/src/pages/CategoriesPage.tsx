import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Category } from "../api";
import { paletteColor, categoryIndex } from "../format";
import { sortHierarchical, topLevel } from "../hierarchy";
import { AddChildPopover } from "@/components/AddChildPopover";
import { NameColorEditPopover } from "@/components/NameColorEditPopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  async function remove(c: Category) {
    setError("");
    try {
      await api.deleteCategory(c.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("categories.deleteFailed"));
    }
  }

  const rows = sortHierarchical(categories);
  const topOptions = topLevel(categories);

  return (
    <div className="px-6 py-6">
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("categories.name")}</TableHead>
            <TableHead>{t("categories.entryCount")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.flatMap(({ parent, children }) => [
            <TableRow key={parent.id}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: paletteColor(parent.color, parent.name) }}
                  />
                  <span className="font-medium">{parent.name}</span>
                </span>
              </TableCell>
              <TableCell>{parent.entryCount}</TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <AddChildPopover
                    namespace="categories"
                    parentName={parent.name}
                    onCreate={(childName) => createChild(parent, childName)}
                  />
                  <NameColorEditPopover
                    namespace="categories"
                    name={parent.name}
                    color={parent.color}
                    parentOptions={topOptions}
                    parentId={parent.parentId}
                    excludeId={parent.id}
                    onSave={async ({ name: nextName, color, parentId }) => {
                      await api.updateCategory(parent.id, { name: nextName, color, parentId });
                      await reload();
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void remove(parent)}
                    disabled={parent.entryCount > 0}
                    title={
                      parent.entryCount > 0
                        ? t("categories.deleteBlockedTitle")
                        : children.length > 0
                          ? t("categories.deleteCascadeTitle", { count: children.length })
                          : t("categories.delete")
                    }
                  >
                    {t("categories.delete")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>,
            ...children.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="flex items-center gap-2 pl-6">
                    <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: paletteColor(c.color, c.name) }}
                    />
                    {c.name}
                  </span>
                </TableCell>
                <TableCell>{c.entryCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <NameColorEditPopover
                      namespace="categories"
                      name={c.name}
                      color={c.color}
                      parentOptions={topOptions}
                      parentId={c.parentId}
                      excludeId={c.id}
                      onSave={async ({ name: nextName, color, parentId }) => {
                        await api.updateCategory(c.id, { name: nextName, color, parentId });
                        await reload();
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void remove(c)}
                      disabled={c.entryCount > 0}
                      title={c.entryCount > 0 ? t("categories.deleteBlockedTitle") : t("categories.delete")}
                    >
                      {t("categories.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )),
          ])}
        </TableBody>
      </Table>
    </div>
  );
}
