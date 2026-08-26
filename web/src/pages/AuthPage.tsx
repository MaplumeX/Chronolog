import { useState, type FormEvent } from "react";
import { ApiError, api, type User } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthPage(props: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      setError(err instanceof ApiError ? err.message : "请求失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <form className="w-full max-w-sm space-y-4" onSubmit={onSubmit}>
        <div>
          <h1 className="text-2xl font-semibold">Chronolog</h1>
          <p className="mt-1 text-sm text-muted-foreground">记录时间去了哪里</p>
        </div>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (v === "login" || v === "register") setMode(v);
          }}
        >
          <TabsList>
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
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
          {mode === "login" ? "登录" : "注册"}
        </Button>
      </form>
    </div>
  );
}
