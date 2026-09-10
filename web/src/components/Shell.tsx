import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { formatDuration } from "../format";
import { useIsMobile } from "../hooks/use-mobile";
import { MobileTabBar } from "./MobileTabBar";
import { NAV_ITEMS, type PageId } from "./nav-items";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export type { PageId } from "./nav-items";

function ShellNav(props: {
  page: PageId;
  elapsedSeconds?: number;
  onPage: (page: PageId) => void;
}) {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();

  function go(id: PageId) {
    props.onPage(id);
    if (isMobile) setOpenMobile(false);
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase tracking-wide">
        {t("nav.group")}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => {
            const label = t(item.labelKey);
            const runningLabel =
              item.id === "timer" && props.elapsedSeconds != null
                ? `${label} ${formatDuration(props.elapsedSeconds)}`
                : label;
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  type="button"
                  isActive={props.page === item.id}
                  tooltip={runningLabel}
                  onClick={() => go(item.id)}
                >
                  <item.icon />
                  <span>{label}</span>
                  {item.id === "timer" && props.elapsedSeconds != null ? (
                    <SidebarMenuBadge className="tabular-nums">
                      {formatDuration(props.elapsedSeconds)}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function ShellUserButton(props: {
  username: string;
  displayName?: string | null;
}) {
  return (
    <SidebarMenuButton className="pointer-events-none" tabIndex={-1}>
      <span className="flex size-4 items-center justify-center text-xs font-medium">
        {props.username.slice(0, 1)}
      </span>
      <span className="truncate">{props.displayName ?? props.username}</span>
    </SidebarMenuButton>
  );
}

function ShellSettingsButton(props: { onPage: (page: PageId) => void }) {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();

  function goSettings() {
    props.onPage("settings");
    if (isMobile) setOpenMobile(false);
  }

  return (
    <SidebarMenuButton
      type="button"
      tooltip={t("nav.settings")}
      onClick={goSettings}
    >
      <Settings />
      <span>{t("nav.settings")}</span>
    </SidebarMenuButton>
  );
}

/** 移动端设置按钮：右上角图标，命中区 ≥40px（视觉 size-9 + 扩展 hit area）。 */
function MobileSettingsButton(props: {
  title: string;
  onPage: (page: PageId) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative size-9 shrink-0 after:absolute after:-inset-1.5"
      aria-label={props.title}
      onClick={() => props.onPage("settings")}
    >
      <Settings className="size-5" />
    </Button>
  );
}

export function Shell(props: {
  username: string;
  displayName?: string | null;
  page: PageId;
  elapsedSeconds?: number;
  onPage: (page: PageId) => void;
  /** 顶栏内容：非 Timer 页为页面大标题，Timer 页为 TimerBar（仅桌面渲染；移动端 timer 页固定显示页面标题） */
  header?: ReactNode;
  /** 移动端 Timer 页底部停靠胶囊（仅移动端分支渲染，桌面忽略） */
  mobileTimerDock?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (isMobile) {
    // 移动端：无侧栏抽屉 —— 顶栏（标题 + 设置入口）+ 底部 Tab 栏 + Timer 页停靠胶囊
    // timer 页的 header（TimerBar）不进移动端顶栏，改为统一的页面标题；
    // 计时入口由 Tab 栏上方的停靠胶囊（mobileTimerDock 插槽）承担。
    const dockPresent = props.page === "timer" && props.mobileTimerDock != null;
    return (
      <div className="flex h-dvh min-h-dvh flex-col bg-background">
        <header className="flex min-h-12 shrink-0 items-center gap-1 border-b px-2">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            {props.page === "timer" ? (
              <h1 className="px-2 text-xl font-semibold tracking-tight">
                {t("nav.timer")}
              </h1>
            ) : (
              props.header
            )}
          </div>
          <MobileSettingsButton
            title={t("nav.settings")}
            onPage={props.onPage}
          />
        </header>
        <div
          className={
            dockPresent
              ? "flex min-h-0 flex-1 flex-col overflow-auto pb-[calc(8.5rem+env(safe-area-inset-bottom))]"
              : "flex min-h-0 flex-1 flex-col overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom))]"
          }
        >
          {props.children}
        </div>
        <MobileTabBar page={props.page} onPage={props.onPage} />
        {dockPresent ? props.mobileTimerDock : null}
      </div>
    );
  }

  return (
    <SidebarProvider className="h-dvh min-h-dvh">
      <Sidebar collapsible="icon">
        {/* 品牌区：lg 按钮 p-2 与 p-1 容器合成 px-3，与 nav 项（p-2 容器 + px-2 按钮）左缘对齐 */}
        <SidebarHeader className="p-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="pointer-events-none">
                <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  C
                </span>
                <span className="truncate font-semibold tracking-tight">Chronolog</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <ShellNav
            page={props.page}
            elapsedSeconds={props.elapsedSeconds}
            onPage={props.onPage}
          />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <ShellUserButton
                username={props.username}
                displayName={props.displayName}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ShellSettingsButton onPage={props.onPage} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex min-h-12 shrink-0 items-center border-b px-2">
          <SidebarTrigger />
          {props.header}
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {props.children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
