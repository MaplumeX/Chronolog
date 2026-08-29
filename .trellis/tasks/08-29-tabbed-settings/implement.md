# 执行计划

## 步骤

1. **i18n 文案**（zh.ts / en.ts）
   - 新增 `settings.tabGeneral` / `settings.tabAccount` / `settings.tabTokens` / `settings.logout`。
   - 移除不再使用的 key（如 `shell.logout` 若无他处引用；`nav.tokens` 若仅旧入口使用则保留给 tokens tab 标题用，视实际引用决定）。

2. **LanguageSwitcher 改造**
   - 触发器改为普通 `Button`，脱离 `SidebarMenuButton`。

3. **SettingsPage 改造**
   - 引入 Tabs，三 tab 结构；新增 `themeMode` / `onThemeMode` / `onLogout` props。
   - 账户 tab 增加"退出登录"按钮区块。
   - 内嵌 TokensPage 组件。
   - 通用 tab 内用 Label 标注语言、主题两个行式控件。

4. **Shell 瘦身**
   - `ITEMS` 移除 tokens；footer 移除三个入口；删除 `onLogout` / `themeMode` / `onThemeMode` props 与相关 import。

5. **App.tsx 接线**
   - `PageId` 移除 `"tokens"`；`HEADER_TITLE_KEYS` 移除 tokens；theme/logout props 改传 SettingsPage。

## 验证命令

```bash
cd web && npm run build
```

- [ ] build 通过，无类型错误
- [ ] 手动核对：侧边栏（含 icon 折叠态）无语言/主题/登出/Tokens 入口
- [ ] 手动核对：设置页三 tab 均可用，语言/主题切换即时生效
- [ ] grep 确认无 `PageId` 含 `"tokens"` 的死引用、无未使用 import

## 回滚点

单 commit，revert 即可。