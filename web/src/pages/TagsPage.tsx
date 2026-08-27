import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Tag } from "../api";
import { categoryColor } from "../format";
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
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
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
      await api.createTag(name);
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tags.createFailed"));
    }
  }

  async function save(id: string) {
    setError("");
    try {
      await api.renameTag(id, editName);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tags.renameFailed"));
    }
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
          {tags.map((tag) => (
            <TableRow key={tag.id}>
              <TableCell>
                {editing === tag.id ? (
                  <div className="flex items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void save(tag.id)}
                      disabled={!editName.trim()}
                    >
                      {t("tags.save")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                      {t("tags.cancel")}
                    </Button>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: categoryColor(tag.name) }}
                    />
                    {tag.name}
                  </span>
                )}
              </TableCell>
              <TableCell>{tag.entryCount}</TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(tag.id);
                      setEditName(tag.name);
                    }}
                  >
                    {t("tags.rename")}
                  </Button>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
