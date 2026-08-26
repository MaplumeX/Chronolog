# shadcn Sidebar for Chronolog

Source: https://ui.shadcn.com/docs/components/base/sidebar

Install: `npx shadcn@latest add sidebar` (pulls Sheet, Tooltip, Separator, Button, etc.).

Required composition:

```
SidebarProvider
├── Sidebar collapsible="icon"
│   ├── SidebarHeader   (brand)
│   ├── SidebarContent  (计时 / 统计 / 分类)
│   ├── SidebarFooter   (username + 退出)
│   └── SidebarRail
├── SidebarInset
│   ├── SidebarTrigger  (desktop collapse + mobile open)
│   └── page
```

`collapsible="icon"`: desktop collapses to an icon rail (main grows). Below the sidebar mobile breakpoint (~768px), the same `Sidebar` renders as a Sheet drawer. `useSidebar()` exposes `isMobile`, `openMobile`, `toggleSidebar`.

Do not use `variant="floating"` or `inset` (those look like cards). Use default `variant="sidebar"`.

`SidebarMenuBadge` can show running elapsed on the 计时 item. Collapsed/icon mode still shows a tooltip via the sidebar’s built-in Tooltip.

`SidebarProvider` may persist open state in a UI cookie. That is chrome, not auth. Do not add `localStorage` for this. Auth remains the HttpOnly `sid` cookie only.

`SidebarTrigger` lives in a thin inset header. That header is a control strip, not a second navigation: do not repeat 计时 / 统计 / 分类 there.
