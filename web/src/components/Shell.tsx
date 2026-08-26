import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChartNoAxesColumn, LogOut, Tags, Timer } from "lucide-react";
import { formatDuration } from "../format";
import { LanguageSwitcher } from "../i18n/LanguageSwitcher";
import type { zh } from "../i18n/locales/zh";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

export type PageId = "timer" | "stats" | "categories";

const ITEMS: { id: PageId; labelKey: keyof typeof zh; icon: typeof Timer }[] = [
  { id: "timer", labelKey: "nav.timer", icon: Timer },
  { id: "stats", labelKey: "nav.stats", icon: ChartNoAxesColumn },
  { id: "categories", labelKey: "nav.categories", icon: Tags },
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

export function Shell(props: {
  username: string;
  page: PageId;
  elapsedSeconds?: number;
  onPage: (page: PageId) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
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
          <ShellNav page={props.page} elapsedSeconds={props.elapsedSeconds} onPage={props.onPage} />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={props.username} className="pointer-events-none">
                <span className="flex size-4 items-center justify-center text-xs font-medium">
                  {props.username.slice(0, 1)}
                </span>
                <span className="truncate">{props.username}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <LanguageSwitcher />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton type="button" tooltip={t("shell.logout")} onClick={props.onLogout}>
                <LogOut />
                <span>{t("shell.logout")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b px-2">
          <SidebarTrigger />
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{props.children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
