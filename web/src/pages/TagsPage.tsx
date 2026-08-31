import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type Tag } from "../api";
import { categoryIndex } from "../format";
import { topLevel } from "../hierarchy";
import { HierarchicalListCard } from "@/components/HierarchicalListCard";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TagsPage() {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
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

  async function update(
    tag: Tag,
    next: { name: string; color: number; parentId: string | null },
  ) {
    await api.updateTag(tag.id, next);
    await reload();
  }

  async function remove(tag: Tag) {
    setError("");
    try {
      await api.deleteTag(tag.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tags.deleteFailed"));
    }
  }

  const topOptions = topLevel(tags);

  return (
    <PageContainer size="wide">
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
      <HierarchicalListCard
        namespace="tags"
        items={tags}
        topOptions={topOptions}
        onCreateChild={createChild}
        onUpdate={update}
        onDelete={remove}
      />
    </PageContainer>
  );
}
