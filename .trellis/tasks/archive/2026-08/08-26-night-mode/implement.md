# 夜间模式 — 实施计划

## 实施清单（按序）

1. **styles.css**：在 `:root` 变量块后新增 `.dark` 变量块（shadcn 标准 dark 变量，oklch，覆盖全族含 sidebar/chart）。
2. **index.html**：`<head>` 内联防闪烁脚本（读 localStorage → 缺失查 matchMedia → toggle `.dark` class）。
3. **web/src/hooks/use-theme.ts**（新建）：`ThemeMode` 类型 + `useTheme()` hook。
   - 初始化：读 localStorage（缺失 → "system"），应用 class。
   - `setMode`：写 localStorage + 应用 class。
   - system 模式监听 `matchMedia("(prefers-color-scheme: dark)")` change。
4. **web/src/format.ts**：新增 `contrastText(hex): "#fff" | "#111"`（WCAG 相对亮度）。
5. **web/src/components/Timeline.tsx**：色块文字 `#fff` → `contrastText(color)`。
6. **web/src/components/ThemeSwitcher.tsx**（新建）：dropdown-menu 三态（明/暗/跟随系统），当前项 Check 图标，Sun/Moon/Monitor 图标。
7. **web/src/components/Shell.tsx**：SidebarFooter 用户名项下方插入 `<ThemeSwitcher />`。
8. **web/src/main.tsx**：挂载 `<ThemeProvider>`（或 App 内调用 useTheme，视 hook 设计）。

## 验证命令

- `cd web && npm run typecheck`
- `cd web && npm run build`
- 手动验证（dev server）：
  - 三态切换即时生效，所有页面（计时/统计/分类/登录）暗色可读
  - 刷新后保持选择
  - 无持久化时跟随系统；system 模式下改系统主题实时响应
  - 硬刷新无明暗闪烁
  - 时间线色块文字对比度（含浅色 `#ffb703`）

## 风险文件 / 回滚点

- `web/src/styles.css`（.dark 变量块）— 回滚：删除该块
- `web/index.html`（内联脚本）— 回滚：删除 script
- `web/src/hooks/use-theme.ts`、`web/src/components/ThemeSwitcher.tsx`（新文件）— 回滚：删除
- `web/src/format.ts`、`Timeline.tsx`、`Shell.tsx`、`main.tsx`（小改动）— 回滚：git checkout

## 检查门

- 全部清单项完成后，跑验证命令 + 手动验证清单，再进入 Phase 3（spec 更新 + commit）。
