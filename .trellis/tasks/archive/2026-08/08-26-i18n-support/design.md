# 前端 i18n 国际化支持 — Design

## 技术选型

- **库**：`i18next` + `react-i18next`（用户已确认方案 A）。
- **不引入** `i18next-browser-languagedetector`：需求为"首次访问默认中文"，浏览器语言检测会违背该约束。语言来源仅 localStorage，缺失时 fallback 到 `zh`。
- **资源文件**：TypeScript 模块（`locales/zh.ts` / `locales/en.ts`），而非 JSON。理由：Vite 下无需额外 loader，且资源对象可被 i18next 推断为类型，`t()` 的 key 有编译期检查（`resources` 泛型推断）。

## 目录结构

```
web/src/i18n/
  index.ts            # i18n 初始化：import 资源、initReactI18next、lng 读取、languageChanged 事件
  locales/zh.ts       # 中文资源（默认）
  locales/en.ts       # 英文资源
  LanguageSwitcher.tsx# 语言切换 UI（DropdownMenu，放 Shell footer）
```

## 初始化配置

```ts
i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: localStorage.getItem("chronolog.lang") ?? "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false }, // React 已转义
});
```

- 切换语言：`i18n.changeLanguage(lng)`，同时写入 `localStorage.setItem("chronolog.lang", lng)`。
- `index.html` 的 `<html lang>` 通过 `languageChanged` 事件同步更新（`document.documentElement.lang`）。

## 文案替换策略

- 所有组件通过 `useTranslation()` 的 `t("key")` 取文案；`format.ts` 等非组件模块直接 `import i18n from "./i18n"` 读取 `i18n.language` / `i18n.t`。
- 资源 key 按页面/组件命名空间组织（如 `nav.timer`、`auth.login`、`timer.placeholder`），扁平结构，不启用多命名空间（保持简单）。
- **不翻译**：品牌名 `Chronolog`、用户生成内容（分类名、描述）、后端返回的错误消息（`ApiError.message` 原样展示）。
- **前端自有错误文案**（`api.ts` 的 `无法连接服务器` / `请求失败` 兜底、各页面的 `加载失败` / `操作失败` 等）需要翻译。

## 日期/时间 locale 处理

`format.ts` 当前硬编码 `zh-CN`：

- `formatClock`：`toLocaleTimeString("zh-CN", ...)` → 改为 `i18n.language`（`zh` → `zh-CN` 映射，或直接传 `i18n.language`，`toLocaleTimeString` 接受 BCP47 tag，`zh` 合法）。
- `formatDayLabel`：`toLocaleDateString("zh-CN", ...)` 同上；前缀 `今天 · ` 改为翻译 key（`timeline.todayPrefix`），英文为 `Today · `。
- `formatDuration`（`h:mm:ss`）与 `categoryColor`（hash 调色板）与语言无关，不动。

## 语言切换 UI

- 位置：`Shell` footer，`退出` 按钮上方或下方，使用 shadcn `DropdownMenu`（与 `CategoryPicker` 模式一致）。
- 触发按钮显示当前语言（`中文` / `English`），菜单项为 `中文`、`English`。
- 切换后 `changeLanguage` 触发 React 重渲染，界面即时更新。

## 兼容性 / 风险

- react-i18next v15+ 兼容 React 19（旧版有 JSX namespace 类型问题，已修复）。
- `t()` 返回 string，替换 JSX 内联文本时注意 `aria-label`、`title`、`placeholder` 等属性同样替换。
- `Timeline` 中 `无说明` 是数据兜底文案，翻译为 `noDescription`。
- 无测试框架（web 无 test script），验证靠 `typecheck` + `build` + 手动运行。

## 范围外

- `server/` 后端错误消息不翻译。
- 不引入复数/ICU 语法（当前文案无复数需求）。
- 不做语言包懒加载（仅 2 种语言，内联即可）。
