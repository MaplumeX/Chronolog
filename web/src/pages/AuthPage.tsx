import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type User } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthPage(props: { onAuthed: (user: User) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    // meta 极少失败；失败时按开放处理，不阻塞登录
    api
      .meta()
      .then((m) => setRegistrationOpen(m.registrationOpen))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, password);
      props.onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Chronolog</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.tagline")}</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={onSubmit}>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (v === "login" || v === "register") setMode(v);
          }}
        >
          <TabsList>
            <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
            <TabsTrigger value="register" disabled={!registrationOpen}>
              {t("auth.register")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {!registrationOpen ? (
          <p className="text-sm text-muted-foreground">{t("auth.registrationClosed")}</p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="username">{t("auth.username")}</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </div>
        {error ? <p className="min-h-[1.2em] text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" type="submit" disabled={busy}>
          {mode === "login" ? t("auth.login") : t("auth.register")}
        </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
