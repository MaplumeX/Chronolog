# 前端 i18n 国际化支持

## Goal

为 `web/` 前端引入国际化（i18n）支持：将当前硬编码的中文 UI 文案抽取为语言资源，支持中文（默认）与英文两种语言，并提供语言切换 UI 与持久化机制，使应用可被中英文用户使用。

## Background

- 当前 `web/` 全部 UI 文案为硬编码中文，分布在 9 个文件（`App.tsx`、`Shell.tsx`、`TimerBar.tsx`、`CategoryPicker.tsx`、`Timeline.tsx`、`AuthPage.tsx`、`TimerPage.tsx`、`StatsPage.tsx`、`CategoriesPage.tsx`），另有 `format.ts` 的日期/时间格式化硬编码 `zh-CN` locale、`api.ts` 的兜底错误文案。
- 技术栈：React 19 + Vite 8 + TypeScript + Tailwind v4 + shadcn/ui，无测试框架（web 无 test script）。

## Requirements

- 支持两种语言：中文（默认）与英文。
- 所有前端 UI 文案（页面、组件、占位符、aria-label、tooltip、错误提示等）均通过 i18n 机制提供，不再硬编码。
- 提供语言切换 UI（位于 Shell 侧边栏 footer），切换后立即生效。
- 语言选择持久化到 localStorage，刷新/重开页面后保持。
- 首次访问（无持久化记录）时默认使用中文。
- 日期/时间格式化 locale 随语言切换（`format.ts` 的 `formatClock`、`formatDayLabel`）。
- 范围仅限 `web/` 前端。

## Out of Scope

- `server/` 后端返回的错误消息不翻译，前端原样展示（`ApiError.message`）。
- 用户生成内容（分类名、描述）不翻译。
- 品牌名 `Chronolog` 不翻译。
- 不引入复数/ICU 语法、语言包懒加载、浏览器语言自动检测（会违背"默认中文"约束）。

## Acceptance Criteria

- [ ] 引入 i18n 基础设施（`i18next` + `react-i18next`，语言资源文件 + 切换/读取机制），中文与英文资源完整覆盖所有 UI 文案。
- [ ] 代码中不再存在硬编码的中文 UI 文案（用户生成内容如分类名、描述除外）。
- [ ] Shell 侧边栏 footer 提供语言切换入口（中文 / English），切换后界面文案即时更新。
- [ ] 语言选择持久化到 localStorage，刷新/重开页面后保持。
- [ ] 首次访问默认中文。
- [ ] 日期/时间格式化（`formatClock`、`formatDayLabel`）随语言切换。
- [ ] `npm run typecheck -w web` 与 `npm run build -w web` 通过。

## Technical Notes

- 技术选型：`i18next` + `react-i18next`（用户确认方案 A）；不引入 `i18next-browser-languagedetector`。
- 资源文件用 TypeScript 模块（`web/src/i18n/locales/zh.ts` / `en.ts`），利用 i18next 资源类型推断获得 `t()` key 编译期检查。
- 初始化：`lng` 从 `localStorage.getItem("chronolog.lang")` 读取，缺失时 fallback `zh`；`languageChanged` 事件同步 `document.documentElement.lang`。
- 切换语言：`i18n.changeLanguage(lng)` + 写 localStorage。
- 组件内用 `useTranslation()`；`format.ts`、`api.ts` 等非组件模块直接 `import i18n`。
- 详细设计见 `design.md`，执行清单见 `implement.md`。
