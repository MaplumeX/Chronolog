# Implement: 组件与布局重构

## Ordered checklist

1. **Toolchain in `web/`**
   - 安装 `tailwindcss`、`@tailwindcss/vite`、`@types/node`。
   - `vite.config.ts`：`tailwindcss()` 插件 + `@` alias；保留 `/api` proxy。
   - `web/tsconfig.json`：`baseUrl` / `paths` `@/*` → `./src/*`。
   - `npx shadcn@latest init`：new-york、neutral、cssVariables、CSS 文件指向 `src/styles.css`。
   - `shadcn add`：button input label tabs dropdown-menu separator table sidebar tooltip（sidebar 会拉 sheet）。
   - 不要 add `card`。

2. **Tokens**
   - 重写 `web/src/styles.css`：Tailwind import + 浅色 shadcn 变量（无 `.dark` 切换）+ 时间线几何 class。
   - 删掉旧的 `--page` 米色、`.auth-card` / `.stats-card` / `.table-card` / `.timeline-card` 卡片外壳。

3. **Shell**
   - 重写 `components/Shell.tsx`：`SidebarProvider` + `collapsible="icon"` + 窄屏 Sheet。
   - `SidebarTrigger` 放在 inset 顶栏，不重复三项导航。
   - 运行中时长：`SidebarMenuBadge`。

4. **Extract + restyle pages**
   - `CategoryPicker.tsx`、`TimerBar.tsx`、`Timeline.tsx`。
   - `TimerPage` 只编排 fetch 与这三块；时间线数学从现文件原样搬，不改公式。
   - `StatsPage`、`CategoriesPage`、`AuthPage` 换成 shadcn 控件 + 无卡片布局。
   - 窄屏计时条纵向叠。

5. **Cleanup**
   - 确认没有残留旧卡片 class。
   - `main.tsx` 仍 import `./styles.css`。
   - 不改 `api.ts` / `format.ts` 行为（`categoryColor` 可继续被组件 import）。

6. **Validate**
   - 命令见下。手动走登录、计时、三页、折叠、窄屏抽屉。

## Validation commands

```bash
npm run typecheck -w web
npm run build -w web
npm test
```

前端无单测。UI 必须跑 `npm run dev` 或 Docker 后按用户路径点一遍。

## Manual checks

- 桌面：展开侧栏、收成图标轨、主区变宽、运行中「计时」有时长。
- 窄屏（<768）：触发按钮打开抽屉，切换计时/统计/分类，退出。
- 计时：未选分类不能开始；开始/停止；时间线色块、当前时刻线、当日总计；刷新后计时仍在跑。
- 统计：只有这里有分类合计；空状态「今天还没有记录」。
- 分类：增改删；有记录的不能删。
- 登录页：无卡片阴影；登录/注册仍可用。
- 无米色底、无白卡片投影骨架。

## Risky files

- `web/package.json`、`web/vite.config.ts`、`web/tsconfig.json`、`web/src/styles.css`
- `web/src/components/Shell.tsx` 与新建 `components/ui/**`
- 四个 `pages/*.tsx`

回滚点：`git checkout -- web`（未提交）或 revert（已提交）。不要动 `server/`。

## Before `task.py start`

- `prd.md` / `design.md` / `implement.md` 已齐。
- `implement.jsonl` 与 `check.jsonl` 已有真实条目。
- 用户已确认下方最终规划摘要。
