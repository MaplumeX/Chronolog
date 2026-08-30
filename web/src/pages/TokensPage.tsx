import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, X } from "lucide-react";
import { ApiError, api, type ApiToken } from "../api";
import i18n, { localeFor } from "../i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatIso(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function TokensPage() {
  const { t } = useTranslation();
  const locale = localeFor(i18n.language);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function reload() {
    const res = await api.tokens();
    setTokens(res.tokens);
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError ? err.message : t("common.loadFailed")));
  }, []);

  async function create() {
    setError("");
    try {
      const res = await api.createToken(name.trim());
      setName("");
      setCreated(res.token);
      setCopied(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tokens.createFailed"));
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.deleteToken(id);
      setConfirming(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tokens.deleteFailed"));
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      // clipboard 不可用时忽略，用户仍可手动选中复制
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{t("tokens.description")}</p>
      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          placeholder={t("tokens.newNamePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
        />
        <Button type="button" variant="outline" onClick={() => void create()} disabled={!name.trim()}>
          {t("tokens.create")}
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tokens.name")}</TableHead>
            <TableHead>{t("tokens.createdAt")}</TableHead>
            <TableHead>{t("tokens.lastUsedAt")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => (
            <TableRow key={token.id}>
              <TableCell>{token.name}</TableCell>
              <TableCell>{formatIso(token.createdAt, locale)}</TableCell>
              <TableCell>
                {token.lastUsedAt ? formatIso(token.lastUsedAt, locale) : t("tokens.neverUsed")}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  {confirming === token.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void remove(token.id)}
                    >
                      {t("tokens.confirmRevoke")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirming(token.id)}
                    >
                      {t("tokens.revoke")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
          </Table>
        </CardContent>
      </Card>

      {created ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-background p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t("tokens.createdTitle")}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("tokens.close")}
                onClick={() => setCreated(null)}
              >
                <X />
              </Button>
            </div>
            <p className="mb-3 text-sm text-destructive">{t("tokens.createdWarning")}</p>
            <div className="mb-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {created}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />}
                {copied ? t("tokens.copied") : t("tokens.copy")}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setCreated(null)}>
                {t("tokens.done")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}