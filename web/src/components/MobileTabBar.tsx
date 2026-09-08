import { useTranslation } from "react-i18next";
import { NAV_ITEMS, type PageId } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * 移动端（<768px）底部主导航：5 个 Tab 替代侧栏抽屉。
 * 桌面端由 Shell 控制不渲染本组件，md:hidden 仅作兜底。
 */
export function MobileTabBar(props: {
  page: PageId;
  onPage: (page: PageId) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("sidebar.nav")}
      data-testid="mobile-tab-bar"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = props.page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground active:text-foreground",
              active && "text-primary",
            )}
            onClick={() => props.onPage(item.id)}
          >
            <item.icon className="size-5" />
            <span className="text-[11px] leading-none">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
