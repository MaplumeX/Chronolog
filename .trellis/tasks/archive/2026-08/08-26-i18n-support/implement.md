# 前端 i18n 国际化支持 — Implement

## 执行清单

1. **安装依赖**：`npm install -w web i18next react-i18next`
2. **创建语言资源**：`web/src/i18n/locales/zh.ts`（默认，从现有代码抽取全部中文文案）、`web/src/i18n/locales/en.ts`（英文翻译）
3. **创建 i18n 初始化**：`web/src/i18n/index.ts`（`initReactI18next`、lng 从 localStorage 读取、fallback `zh`、`languageChanged` 同步 `document.documentElement.lang`）
4. **接入入口**：`web/src/main.tsx` 顶部 `import "./i18n"`
5. **改造 `format.ts`**：`formatClock` / `formatDayLabel` 使用 `i18n.language` 作为 locale；`今天 · ` 前缀改为翻译 key
6. **改造 `api.ts`**：`无法连接服务器` / `请求失败` 兜底文案改为 `i18n.t`
7. **改造组件与页面**（全部替换为 `useTranslation()`）：
   - `App.tsx`（加载中…）
   - `components/Shell.tsx`（导航标签、退出、tooltip）
   - `components/TimerBar.tsx`（placeholder、aria-label）
   - `components/CategoryPicker.tsx`（无硬编码文案，确认即可）
   - `components/Timeline.tsx`（今天还没有记录、无说明）
   - `pages/AuthPage.tsx`（登录/注册/用户名/密码/标语）
   - `pages/TimerPage.tsx`（选择分类、加载失败、操作失败）
   - `pages/StatsPage.tsx`（统计、按分类合计、今天还没有记录、加载失败）
   - `pages/CategoriesPage.tsx`（分类、新分类名称、添加、名称、记录数、保存、取消、重命名、删除、加载失败、创建失败、重命名失败、删除失败、无法删除 title）
8. **创建 `LanguageSwitcher.tsx`** 并挂到 `Shell` footer
9. **更新 `index.html`**：`lang="zh-CN"` 保持默认（运行时由 languageChanged 更新）

## 验证命令

```bash
npm run typecheck -w web
npm run build -w web
```

## 手动验证（行为变更）

- `npm run dev` 启动，首次访问默认中文
- 切换 English → 界面即时变英文，刷新后保持
- 切换回中文 → 恢复
- 计时页 placeholder、aria-label、tooltip 均随语言变化
- 统计页日期标签（`Today · 8月26日 星期二` / `Today · Aug 26, Tuesday`）随语言变化
- 后端错误消息（如登录失败）原样展示不翻译

## 收尾

- 更新 `.trellis/spec/frontend/quality-guidelines.md` 与 `component-guidelines.md`：UI 语言约束从"Chinese"改为"i18n（zh 默认 / en）"
- 更新 `.trellis/spec/frontend/index.md` 质量检查项（`UI copy is Chinese` → i18n 检查）
- commit

## 回滚点

- 依赖安装后、代码改造前：`git checkout -- web/` 即可回滚（依赖可 `npm uninstall`）
- 每个文件改造独立，可逐个回滚
