import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, setOnUnauthorized, type TimeEntry, type User } from "./api";
import { Shell, type PageId } from "./components/Shell";
import { elapsedSeconds } from "./format";
import { AuthPage } from "./pages/AuthPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { StatsPage } from "./pages/StatsPage";
import { TimerPage } from "./pages/TimerPage";

export function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [page, setPage] = useState<PageId>("timer");
  const [current, setCurrent] = useState<TimeEntry | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setCurrent(null);
    });
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
    return () => setOnUnauthorized(undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .current()
      .then((r) => setCurrent(r.entry))
      .catch(() => setCurrent(null));
  }, [user]);

  useEffect(() => {
    if (!current) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [current]);

  if (user === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">
        {t("app.loading")}
      </div>
    );
  }
  if (!user) return <AuthPage onAuthed={setUser} />;

  async function logout() {
    await api.logout().catch(() => undefined);
    setUser(null);
    setCurrent(null);
  }

  return (
    <Shell
      username={user.username}
      page={page}
      elapsedSeconds={current ? elapsedSeconds(current.startedAt, nowMs) : undefined}
      onPage={setPage}
      onLogout={() => {
        void logout();
      }}
    >
      {page === "timer" ? (
        <TimerPage nowMs={nowMs} current={current} onCurrent={setCurrent} />
      ) : null}
      {page === "stats" ? <StatsPage /> : null}
      {page === "categories" ? <CategoriesPage /> : null}
    </Shell>
  );
}
