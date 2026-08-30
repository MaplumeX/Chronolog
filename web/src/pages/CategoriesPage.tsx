import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Category } from "../api";
import { paletteColor } from "../format";
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
      await api.createCategory(name);
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("categories.createFailed"));
    }
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
          {categories.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <span className="flex items-center gap-2">
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
                    onSave={async ({ name: nextName, color }) => {
                      await api.updateCategory(c.id, { name: nextName, color });
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
