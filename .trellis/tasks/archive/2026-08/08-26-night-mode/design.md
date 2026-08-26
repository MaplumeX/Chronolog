# 夜间模式 — 技术设计

## 架构与边界

纯前端改动，仅涉及 `web/`。后端无涉及。

```
index.html 内联脚本（防闪烁，React 挂载前应用 .dark class）
        ↓
useTheme hook（web/src/hooks/use-theme.ts）
  - 状态: ThemeMode = "light" | "dark" | "system"
  - 持久化: localStorage["chronolog-theme"]
  - 副作用: 切换 document.documentElement 的 .dark class
  - system 模式: 监听 matchMedia("(prefers-color-scheme: dark)") 实时响应
        ↓
ThemeSwitcher 组件（web/src/components/ThemeSwitcher.tsx）
  - 位于 Shell SidebarFooter（用户名/退出按钮附近）
  - dropdown-menu 三态，当前项带 Check 图标
```

## 数据流与契约

- **存储契约**：`localStorage["chronolog-theme"]` ∈ `"light" | "dark" | "system"`；缺失视为 `"system"`。
- **class 契约**：`document.documentElement.classList` 上的 `.dark` 是唯一主题开关；`styles.css` 的 `@custom-variant dark` 已就位。
- **防闪烁**：index.html 内联脚本在 React 挂载前执行，逻辑与 hook 首帧一致（读 localStorage → 缺失时查 matchMedia → toggle class）。hook 挂载后以同一逻辑初始化 state，保证无跳变。
- **system 监听**：仅当 mode === "system" 时注册 `matchMedia` change 监听；切到 light/dark 时移除。

## 样式设计

- **`.dark` 变量集**：采用 shadcn 标准 dark 变量（oklch，与现有 light 变量同源同结构），覆盖 background/foreground/card/popover/primary/secondary/muted/accent/destructive/border/input/ring/chart-1..5/sidebar 全族。组件已全部使用语义化颜色类，无需逐组件改动。
- **分类色块对比度**：`categoryColor()` 8 色板中 `#ffb703`（琥珀）等浅色在白色文字下对比度不足（约 1.9:1）。方案：`format.ts` 新增 `contrastText(hex)`（WCAG 相对亮度计算，返回 `#fff` 或 `#111`），Timeline 色块文字改用该函数。明暗两态均正确，无需感知主题。
- **已知硬编码**：`button.tsx` 的 `text-white`（destructive 按钮）、`sheet.tsx` 的 `bg-black/50`（遮罩）在暗色下均正常，不改动。

## 兼容性与迁移

- 无持久化记录的老用户：默认 system，跟随系统偏好，行为自然。
- 无后端/API 变更，无数据迁移。
- 回滚：删除本次改动文件即可，无残留状态（localStorage key 独立，不影响其他功能）。

## 权衡

- **内联脚本 vs 纯 React 方案**：内联脚本增加 index.html 少量代码，但消除首屏闪烁（FOUC），是主流做法（shadcn 官方 demo 同款），值得。
- **contrastText 计算 vs 暗色下统一加深色板**：计算方案精确、明暗两态都正确；加深方案依赖主题感知且效果不可控。选计算方案。
- **三态 dropdown vs 循环按钮**：三态需 dropdown-menu（项目已有该组件），语义清晰，符合已确认的产品决策。
