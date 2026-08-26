# 夜间模式

## Goal

为 Chronolog 前端（web/）添加夜间模式支持：用户可在明 / 暗 / 跟随系统三态间切换，选择持久化，界面在暗色下可读、美观。

## 背景事实（代码库证据）

- 技术栈：React 19 + Tailwind CSS v4 + shadcn/ui（radix-ui）。`web/src/styles.css` 已声明 `@custom-variant dark (&:is(.dark *))`，但未定义 `.dark` 变量，dark 机制已就位未启用。
- 组件基本全部使用语义化颜色类（`bg-background`、`text-foreground`、`border-border` 等），补上 `.dark` 变量后大部分界面自动适配。
- 分类色块用 `categoryColor()` 固定 8 色 HEX 调色板（`web/src/format.ts`），其中 `#ffb703` 等浅色配白色文字对比度不足；Timeline 色块文字硬编码 `#fff`。
- 目前无 localStorage 使用、无主题状态管理、无切换入口。
- 入口：`web/src/main.tsx` 渲染 `<App />`；布局壳 `web/src/components/Shell.tsx`，SidebarFooter 现有用户名与退出按钮。
- 项目已有 dropdown-menu 组件（`web/src/components/ui/dropdown-menu.tsx`）。

## Requirements

- [ ] 提供明/暗两套主题，暗色覆盖全部页面（计时、统计、分类、登录页）与全部 shadcn 组件（sidebar、button、input、table、tabs、dropdown-menu、sheet、tooltip 等）。
- [ ] 三态切换：明 / 暗 / 跟随系统。首次访问（无持久化记录）跟随系统 `prefers-color-scheme`；手动选择明或暗后固定；"跟随系统"时监听系统主题变化实时响应。
- [ ] 切换入口位于 Sidebar 底部（用户名/退出按钮附近），dropdown-menu 三态，当前项带选中标记。
- [ ] 主题选择持久化（localStorage），刷新/重开页面后保持。
- [ ] 首屏前应用主题（index.html 内联脚本），避免明暗闪烁。
- [ ] 暗色下分类色块与文字对比度可读（按 WCAG 相对亮度计算文字颜色，明暗两态均正确）。

## Acceptance Criteria

- [ ] 三态切换即时生效，所有页面与组件暗色下正常显示、无不可读区域。
- [ ] 刷新页面后主题保持用户选择。
- [ ] 无持久化记录时跟随系统偏好；system 模式下系统主题变化实时响应。
- [ ] 首次加载无明暗闪烁。
- [ ] `cd web && npm run typecheck` 与 `npm run build` 通过。

## Out of Scope

- 后端（server/）任何改动。
- 自定义暗色色板风格（采用 shadcn 标准 dark 变量）。
- 主题切换的动画过渡效果。

## Technical Notes

- 存储契约：`localStorage["chronolog-theme"]` ∈ `"light" | "dark" | "system"`，缺失视为 `"system"`。
- class 契约：`document.documentElement` 上的 `.dark` 是唯一主题开关。
- 已知硬编码不改动：`button.tsx` 的 `text-white`（destructive 按钮）、`sheet.tsx` 的 `bg-black/50`（遮罩），暗色下均正常。
- 详细设计见 `design.md`，执行计划见 `implement.md`。
