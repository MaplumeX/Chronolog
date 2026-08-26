# Design: 组件与布局重构

## Boundaries

只改 `web/`。不改 `server/`、cookie、`api.ts` 的 URL 与 DTO、`format.ts` 的时长/时区/clip/`categoryColor` 算法。

`App.tsx` 继续持有 `user` / `page` / `current` / `nowMs`，继续无 Router。不新增 `src/hooks/`。

shadcn 需要的 `web/src/lib/utils.ts`（`cn`）是对「不要自造 utils」的唯一破例，只放 `clsx` + `tailwind-merge`，不把 `format.ts` 或 `api.ts` 搬进去。

## Stack

在 `web/` 安装：

- `tailwindcss` + `@tailwindcss/vite`
- `npx shadcn@latest init`：style `new-york`，base color `neutral`，cssVariables true，CSS 入口保持 `web/src/styles.css`（`main.tsx` 已 import 它）
- 路径别名 `@/` → `web/src`（`vite.config.ts` + `web/tsconfig.json`）
- 图标：Lucide（shadcn 默认）。全项目只用这一套，计时/统计/分类/退出用 `Timer`、`ChartNoAxesColumn`、`Tags`、`LogOut`

要加的原语（按需 `shadcn add`，不要把 Card 加成页面骨架）：

`button` `input` `label` `tabs` `dropdown-menu` `separator` `table` `sidebar` `tooltip` `sheet`

`sidebar` 会带上它依赖的 Sheet/Tooltip。

## Tokens and surfaces

浅色锁定：只定义 `:root` 的 shadcn 变量，不挂 `.dark` 切换，不读 `prefers-color-scheme` 来反转整页。

- 主区 `--background`：中性灰偏白，不是 `#f6f3ef` 米色，也不是纯 `#ffffff` 铺满当卡片
- 侧栏 `--sidebar`：同色系略深
- `--primary`：近黑，用于开始按钮和主操作
- 停止 / 删除：`destructive`（红），这是语义色，不是第二品牌色
- 分类色：继续 `categoryColor()`，用在点、统计条、时间块上
- 圆角跟 shadcn new-york，全页一套，不要把时间块做成另一套大圆角卡片

`styles.css` 变成：`@import "tailwindcss"` + shadcn 变量 + **一小段时间线几何**（绝对定位的刻度、色块、`now-line`）。时间线坐标不适合纯 utility，保留自定义 class 是故意的，不是旧卡片体系复活。

## Shell

`Shell` 用 `SidebarProvider` + `Sidebar collapsible="icon"` + `SidebarInset`。`variant` 用默认 `sidebar`，不用 `floating` / `inset`（会看起来像卡片）。

| 区域 | 内容 |
|------|------|
| Header | 品牌 Chronolog |
| Content | 计时 / 统计 / 分类（`SidebarMenuButton`，当前页 `isActive`） |
| 计时 badge | 运行中显示 `formatDuration`（`SidebarMenuBadge`，tabular-nums） |
| Footer | 用户名 + 退出 |
| Inset 顶 | 仅 `SidebarTrigger`（桌面折叠成图标轨，窄屏打开抽屉） |

窄屏：Sidebar 自带 Sheet。断点跟组件默认（约 768px）。抽屉里是同一组导航，点一项后关抽屉。不要第二套底栏。

折叠状态：允许 Sidebar 默认的 UI cookie。这不是登录态。禁止把 `sid` 写入 `localStorage`。

未登录：`App` 仍只渲染 `AuthPage`，不挂 `SidebarProvider`。

## Page layouts（无卡片）

分组手段：`border-b`、行间分割、背景差、留白。禁止页面外包一层带 shadow 的白卡片。

**AuthPage**：浅色全页，居中表单（`max-w-sm`）。`Tabs` 切登录/注册。`Input` + `Label`。无 `auth-card` 阴影。

**TimerPage**：上方计时条（`TimerBar`）用底边框贴在 inset 里，窄屏改为描述 / 分类 / 时长+按钮纵向叠。下方 `Timeline` 全宽：日期+当日总计做一条 header，然后可滚动 0:00–24:00 轨道。坐标公式、分档阈值、运行中脉冲、初始滚到「现在」与现实现一致，只换 class。

**StatsPage**：标题 + 日期说明 + 行列表（色点、分类名、条、时长）。条仍是按最大值比例的 div，不用 shadcn `Progress`（那是单色进度，不是分类色）。

**CategoriesPage**：标题 + 名称输入/添加 + `Table`。占用中的删除仍然 disabled，`title` 仍用服务器/现有文案。

## Component split

```
web/src/components/
  ui/                 # shadcn，勿手改行为
  Shell.tsx
  TimerBar.tsx
  CategoryPicker.tsx  # DropdownMenu，替换自制 .menu
  Timeline.tsx        # 从 TimerPage 挪出的 TimelineSection
pages/                # 编排 + 该页数据 fetch
```

`CategoryPicker` 只负责选择 UI；开始/停止留在 `TimerBar` 或 `TimerPage`。不要为这一次抽取 `useTimer`。

## Data flow

不变：`api.ts` + cookie `sid`。401 仍清 session。`nowMs` 仍只在 `App` 打 tick。`TimerPage` 不另开 1s interval。

## Compatibility

- Vite `/api` proxy、生产 `WEB_DIST`、Docker 流程不变。
- `index.html` 保持 `lang="zh-CN"`。
- 字体：系统 UI + Noto Sans SC / PingFang SC，不引入 Inter 作默认西文。
- 全高用 `min-h-dvh`，不用 `h-screen`。

## Trade-offs

- 引入 Tailwind/shadcn 会改 frontend spec（目录、CSS、禁止组件库那几条）。值得，因为用户明确要这套。
- 时间线保留少量自定义 CSS，避免 24h 绝对定位写成无法维护的 arbitrary class。
- Lucide 随 shadcn 进入，取代内联 SVG 图标（开始/停止可用 Lucide `Play` / `Square`，或保留两个小 SVG；不要混 Phosphor）。
- 不做暗色变量，避免时间块在两套背景上对比度翻倍。

## Rollback

未提交：还原 `web/`。已提交：`git revert`。后端与数据不受影响。
