# 技术设计

## 总体

- `PageId` 从 `"timer" | "stats" | "categories" | "tags" | "tokens" | "settings"` 缩减为 `"timer" | "stats" | "categories" | "tags" | "settings"`。
- SettingsPage 内部用 `@/components/ui/tabs`（radix）实现三个 tab；tab 状态为 SettingsPage 本地 state（不进路由），默认激活"账户" tab。

## 组件改动

### Shell.tsx
- `ITEMS` 移除 `tokens` 项。
- footer 只保留 `ShellUserButton`（进入设置的入口），删除 LanguageSwitcher、ThemeSwitcher、登出按钮三个 `SidebarMenuItem`。
- props 相应精简：移除 `onLogout`、`themeMode`、`onThemeMode`。

### LanguageSwitcher.tsx
- 触发器从 `SidebarMenuButton` 改为普通 `Button`（outline、整行），其余 DropdownMenu 逻辑不变。不引入新的 select 组件（项目无 Select，避免过度工程）。
- 保留 `changeLanguage` 调用逻辑。

### ThemeSwitcher.tsx
- 现状已是 `Button`+`DropdownMenu`，基本不动；仅在设置页中以 `Label`（"主题"）标注，作为整行控件使用。

### SettingsPage.tsx
- 新增 props：`themeMode`、`onThemeMode`、`onLogout`。
- 结构：
  ```
  <Tabs defaultValue="general">
    <TabsList>
      <TabsTrigger value="general">通用</TabsTrigger>
      <TabsTrigger value="account">账户</TabsTrigger>
      <TabsTrigger value="tokens">API Tokens</TabsTrigger>
    </TabsList>
    <TabsContent value="general">
      语言（Label + LanguageSwitcher）
      主题（Label + ThemeSwitcher）
    </TabsContent>
    <TabsContent value="account">现有资料/密码/登出/危险区 </TabsContent>
    <TabsContent value="tokens"><TokensPage 内嵌 /></TabsContent>
  </Tabs>
  ```
- 账户 tab 在危险区之前加入"退出登录"区块（outline 按钮）。

### TokensPage.tsx
- 保留组件本体，仅作为 TabsContent 内的子组件渲染（其自身 `px-6` 等布局类视内嵌效果微调，如由 SettingsPage 统一控制 padding，则去掉重复 padding）。

### App.tsx
- 移除 `page === "tokens"` 分支与 `TokensPage` 直接引用（由 SettingsPage 引入）。
- `themeMode` / `setThemeMode` / `logout` 通过 props 传给 SettingsPage；Shell 的对应 props 删除。
- `HEADER_TITLE_KEYS` 移除 `tokens`。

## i18n
- 新增 key（zh/en 同步）：`settings.tabGeneral`（通用）、`settings.tabAccount`（账户）、`settings.tabTokens`（API Tokens）、`settings.logout`（退出登录）。
- 保留现有 `tokens.*`、`language.*`、`theme.*` key（tab 内复用）。

## 兼容性 / 回滚
- 纯前端改动，无 API 变化。回滚即 revert 单个 commit。
- 移动端：TabsList 允许横向滚动（`overflow-x-auto`）以保证小屏可用。