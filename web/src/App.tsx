import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, setOnUnauthorized, type TimeEntry, type User } from "./api";
import { Shell, type PageId } from "./components/Shell";
import { TimerBar } from "./components/TimerBar";
import { Timeline } from "./components/Timeline";
import { elapsedSeconds } from "./format";
import { useTheme } from "./hooks/use-theme";
import { useTimerController } from "./hooks/use-timer-controller";
import { AuthPage } from "./pages/AuthPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { GoalsPage } from "./pages/GoalsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatsPage } from "./pages/StatsPage";
import { TagsPage } from "./pages/TagsPage";

const HEADER_TITLE_KEYS = {
  stats: "nav.stats",
  goals: "nav.goals",
  categories: "nav.categories",
  tags: "nav.tags",
  settings: "nav.settings",
} as const;

export function App() {
  const { t } = useTranslation();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
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

  // 顶栏与内容区共享 Timer 状态；未登录或不在 Timer 页时不发请求
  const timer = useTimerController({
    nowMs,
    current,
    onCurrent: setCurrent,
    enabled: Boolean(user) && page === "timer",
  });

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

  function onAccountDeleted() {
    // DELETE /api/account 已清除 cookie，无需再调 logout（会 401）
    setUser(null);
    setCurrent(null);
  }

  return (
    <Shell
      username={user.username}
      displayName={user.displayName}
      page={page}
      elapsedSeconds={
        current ? elapsedSeconds(current.startedAt, nowMs) : undefined
      }
      onPage={setPage}
      header={
        page === "timer" ? (
          <TimerBar {...timer.barProps} />
        ) : (
          <h1 className="px-2 text-xl font-semibold tracking-tight">
            {t(HEADER_TITLE_KEYS[page])}
          </h1>
        )
      }
    >
      {page === "timer" ? <Timeline {...timer.timelineProps} /> : null}
      {page === "stats" ? <StatsPage /> : null}
      {page === "goals" ? <GoalsPage /> : null}
      {page === "categories" ? <CategoriesPage /> : null}
      {page === "tags" ? <TagsPage /> : null}
      {page === "settings" ? (
        <SettingsPage
          user={user}
          themeMode={themeMode}
          onThemeMode={setThemeMode}
          onLogout={() => {
            void logout();
          }}
          onUserUpdated={setUser}
          onLoggedOut={onAccountDeleted}
        />
      ) : null}
    </Shell>
  );
}
