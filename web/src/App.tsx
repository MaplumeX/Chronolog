import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, setOnUnauthorized, type TimeEntry, type User } from "./api";
import { Shell, type PageId } from "./components/Shell";
import { MobileTimerDock } from "./components/MobileTimerDock";
import { TimerBar } from "./components/TimerBar";
import { Timeline } from "./components/Timeline";
import { elapsedSeconds, browserTz } from "./format";
import { useTheme } from "./hooks/use-theme";
import { useTimerController } from "./hooks/use-timer-controller";
import { AuthPage } from "./pages/AuthPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { GoalsPage } from "./pages/GoalsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatsPage } from "./pages/stats/StatsPage";
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
  // 已为其触发过时区自动持久化的 user id，避免 me()/登录/其他路径重复触发
  const tzPersistedForRef = useRef<string | null>(null);
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

  // 首次访问自动持久化检测到的浏览器时区：timezone 为 null 时 fire-and-forget
  // 写入，成功后 setUser（此后条件不再成立，不会循环）；失败静默，下次访问重试。
  // UI 不等待持久化：tz 派生仍以 browserTz() 兜底，瞬态期间行为与现状一致。
  useEffect(() => {
    if (!user || user.timezone !== null) return;
    if (tzPersistedForRef.current === user.id) return;
    tzPersistedForRef.current = user.id;
    api
      .updateProfile({ timezone: browserTz() })
      .then(setUser)
      .catch(() => undefined);
  }, [user]);

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
  // tz 单一来源：用户设置优先，未设置回退浏览器时区；未登录也用 browserTz 兜底
  const tz = user?.timezone ?? browserTz();
  const timer = useTimerController({
    tz,
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

  const timerBarProps = timer.barProps;
  // 移动端 timer 页的停靠胶囊（桌面端 Shell 忽略该插槽）
  const mobileTimerDock =
    page === "timer" ? <MobileTimerDock {...timerBarProps} /> : null;

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
          <TimerBar {...timerBarProps} />
        ) : (
          <h1 className="flex min-h-12 items-center px-2 text-xl font-semibold tracking-tight">
            {t(HEADER_TITLE_KEYS[page])}
          </h1>
        )
      }
      mobileTimerDock={mobileTimerDock}
    >
      {page === "timer" ? <Timeline {...timer.timelineProps} /> : null}
      {page === "stats" ? <StatsPage tz={tz} /> : null}
      {page === "goals" ? <GoalsPage tz={tz} /> : null}
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
