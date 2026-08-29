# Design Tokens

色彩体系以 `web/src/styles.css` 为唯一定义源（shadcn CSS 变量命名，全部 oklch 表达）。本文档是约定速查，不复制具体数值——改 token 时直接改 `styles.css`，并重跑对比度脚本（见任务 08-29 research `contrast-check.mjs`）校准。

## 主题策略

**teal 冷色系双主题**（light / dark 并重）：

- Light：冷白底（微蓝调灰，hue ≈ 220）+ teal primary（hue ≈ 195–210），muted/accent/border 为低 chroma（0.01–0.02）冷灰。
- Dark：冷深灰底 + 亮青 primary；border/input 保持半透明白（`oklch(1 0 0 / N%)`）模式。
- 主题切换：`ThemeSwitcher`（light/dark/system 三态）→ `.dark` class → CSS 变量整体翻转。持久化见 state-management（`chronolog-theme`）。

## 语义 token

保留 shadcn 变量命名（`--background`、`--primary`、`--muted` 等），经 `@theme inline` 映射为 `--color-*` 供 Tailwind 使用（`bg-primary`、`text-muted-foreground`…）。规则：

- 组件一律消费语义 class，不写裸色值。
- `--ring` 跟随 primary；sidebar 系列与 background 同族（dark 下 sidebar 略深于 background）。
- `--destructive` 保持红色系（hue 22–27）。
- 语义 token 配对（如 primary × primary-foreground）必须满足 WCAG AA（4.5:1），改动后用对比度脚本验证。

## 分类色板

`--category-1..8`（styles.css 内 `:root`（light）与 `.dark`（dark）各一套）：

- light 亮版（L≈0.74、C≈0.09）、dark 暗版（L≈0.58、C≈0.08），柔和低饱和，色相均衡绕色环分布（15/50/100/135/250/285/315/345，暖4冷4），两套保持同色相。
- **185–225 hue 区间留给 primary**，分类色避开，防止混淆。
- 每色配套 `--category-N-foreground`（light 下深色文字、dark 下近白略带色相），随主题翻转；Timeline 色块文字/派生色（tag 徽章底、running 轮廓）消费它。
- `web/src/format.ts` 仅持有 token 名：`categoryIndex(name)`（hash → 0–7）+ `categoryColor(name)` 返回 `var(--category-N)`。具体数值只在 styles.css 一处定义，无需两边同步。
- 分类颜色不落库，始终由名称 hash 分配（`categoryColor`）；hash 逻辑不可改动，否则既有映射漂移。
- Timeline 时间块底色用 `color-mix(in srgb, <categoryColor> 80%, transparent)` 半透明透出轨道背景；小色点/条形（picker、列表、Stats）用实色 `categoryColor()`。

## 圆角

`--radius: 0.625rem`，派生 `--radius-sm/md/lg/xl`（calc 加减）。组件用 `rounded-*` 工具类，不写裸 px。

## 排版

- `--font-sans`：系统栈 + 中文回退（Noto Sans SC / PingFang SC / Microsoft YaHei）。
- `--font-mono`：ui-monospace 系统栈，用于时长 / 时刻等数字场景，配 `tabular-nums`。
- 正文默认 `text-foreground`（body 上 `@apply`）；页面标题 `text-lg font-semibold`（Shell header）；小号刻度文字 12px、tag 徽章 11px（见 Timeline CSS）。

## 间距

页面布局用 Tailwind 间距工具类；不做全局 spacing token 自定义。视觉分组靠 spacing、`border-b` 与 surface 色，不用浮起卡片（见 component-guidelines）。

## 禁止事项

- 不在组件里硬编码 hex / rgba 颜色（destructive 语义色等经 token 引用除外）。
- 叠在彩色色块上的前景（tag 徽章底、running 轮廓）用 `color-mix(in srgb, currentColor N%, transparent)` 从色块文字色派生，不用白色硬编码。例外：`timeline-pulse` 阴影画在色块外的页面背景上，不从文字色派生（dark 下深色文字不可见），改用 `color-mix(var(--ring) N%, transparent)`。
- 分类色已按 per-theme 双套定义（light 亮版 / dark 暗版 + 各自 foreground），色相不变。