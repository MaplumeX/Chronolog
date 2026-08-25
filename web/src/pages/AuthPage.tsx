import { useState, type FormEvent } from "react";
import { ApiError, api, type User } from "../api";

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
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Chronolog</h1>
        <p className="lead">记录时间去了哪里</p>
        <div className="tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>
        <label className="field">
          <span>用户名</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
        <div className="error">{error}</div>
        <button className="primary" type="submit" disabled={busy}>
          {mode === "login" ? "登录" : "注册"}
        </button>
      </form>
    </div>
  );
}
