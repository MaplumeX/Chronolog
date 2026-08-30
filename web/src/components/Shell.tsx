import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChartNoAxesColumn,
  Settings,
  Tag,
  Tags,
  Target,
  Timer,
} from "lucide-react";
import { formatDuration } from "../format";
import type { zh } from "../i18n/locales/zh";
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

export type PageId =
  "timer" | "stats" | "goals" | "categories" | "tags" | "settings";

const ITEMS: { id: PageId; labelKey: keyof typeof zh; icon: typeof Timer }[] = [
  { id: "timer", labelKey: "nav.timer", icon: Timer },
  { id: "stats", labelKey: "nav.stats", icon: ChartNoAxesColumn },
  { id: "goals", labelKey: "nav.goals", icon: Target },
  { id: "categories", labelKey: "nav.categories", icon: Tags },
  { id: "tags", labelKey: "nav.tags", icon: Tag },
];

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
          {ITEMS.map((item) => {
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

export function Shell(props: {
  username: string;
  displayName?: string | null;
  page: PageId;
  elapsedSeconds?: number;
  onPage: (page: PageId) => void;
  /** 顶栏内容：非 Timer 页为页面大标题，Timer 页为 TimerBar */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarProvider className="h-dvh min-h-dvh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="pointer-events-none">
                <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  C
                </span>
                <span className="truncate font-semibold">Chronolog</span>
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
