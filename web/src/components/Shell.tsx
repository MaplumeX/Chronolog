import type { ReactNode } from "react";
import { ChartNoAxesColumn, LogOut, Tags, Timer } from "lucide-react";
import { formatDuration } from "../format";
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

const ITEMS: { id: PageId; label: string; icon: typeof Timer }[] = [
  { id: "timer", label: "计时", icon: Timer },
  { id: "stats", label: "统计", icon: ChartNoAxesColumn },
  { id: "categories", label: "分类", icon: Tags },
];

function ShellNav(props: {
  page: PageId;
  elapsedSeconds?: number;
  onPage: (page: PageId) => void;
}) {
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
            const runningLabel =
              item.id === "timer" && props.elapsedSeconds != null
                ? `${item.label} ${formatDuration(props.elapsedSeconds)}`
                : item.label;
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  type="button"
                  isActive={props.page === item.id}
                  tooltip={runningLabel}
                  onClick={() => go(item.id)}
                >
                  <item.icon />
                  <span>{item.label}</span>
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
              <SidebarMenuButton type="button" tooltip="退出" onClick={props.onLogout}>
                <LogOut />
                <span>退出</span>
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
