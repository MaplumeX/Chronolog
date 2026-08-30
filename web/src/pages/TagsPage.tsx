import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Tag } from "../api";
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

export function TagsPage() {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    const res = await api.tags();
    setTags(res.tags);
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
  }, []);

  async function create() {
    setError("");
    try {
      await api.createTag(name.trim(), categoryIndex(name.trim()) + 1);
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tags.createFailed"));
    }
  }

  async function createChild(parent: Tag, childName: string) {
    setError("");
    await api.createTag(childName, categoryIndex(childName) + 1, parent.id);
    await reload();
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.deleteTag(id);
      setConfirming(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tags.deleteFailed"));
    }
  }

  const rows = sortHierarchical(tags);
  const topOptions = topLevel(tags);

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          placeholder={t("tags.newNamePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
        />
        <Button type="button" variant="outline" onClick={() => void create()} disabled={!name.trim()}>
          {t("tags.add")}
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tags.name")}</TableHead>
            <TableHead>{t("tags.entryCount")}</TableHead>
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
                    namespace="tags"
                    parentName={parent.name}
                    onCreate={(childName) => createChild(parent, childName)}
                  />
                  <NameColorEditPopover
                    namespace="tags"
                    name={parent.name}
                    color={parent.color}
                    parentOptions={topOptions}
                    parentId={parent.parentId}
                    excludeId={parent.id}
                    onSave={async ({ name: nextName, color, parentId }) => {
                      await api.updateTag(parent.id, { name: nextName, color, parentId });
                      await reload();
                    }}
                  />
                  {confirming === parent.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void remove(parent.id)}
                    >
                      {t("tags.confirmDelete")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      title={
                        children.length > 0
                          ? t("tags.deleteCascadeTitle", { count: children.length })
                          : t("tags.delete")
                      }
                      onClick={() => setConfirming(parent.id)}
                    >
                      {t("tags.delete")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>,
            ...children.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>
                  <span className="flex items-center gap-2 pl-6">
                    <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: paletteColor(tag.color, tag.name) }}
                    />
                    {tag.name}
                  </span>
                </TableCell>
                <TableCell>{tag.entryCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <NameColorEditPopover
                      namespace="tags"
                      name={tag.name}
                      color={tag.color}
                      parentOptions={topOptions}
                      parentId={tag.parentId}
                      excludeId={tag.id}
                      onSave={async ({ name: nextName, color, parentId }) => {
                        await api.updateTag(tag.id, { name: nextName, color, parentId });
                        await reload();
                      }}
                    />
                    {confirming === tag.id ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void remove(tag.id)}
                      >
                        {t("tags.confirmDelete")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirming(tag.id)}
                      >
                        {t("tags.delete")}
                      </Button>
                    )}
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
