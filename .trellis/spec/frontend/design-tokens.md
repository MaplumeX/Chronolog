# Design Tokens

色彩体系以 `web/src/styles.css` 为唯一定义源（shadcn CSS 变量命名，全部 oklch 表达）。本文档是约定速查，不复制具体数值——改 token 时直接改 `styles.css`，并重跑对比度脚本（见任务 08-29 research `contrast-check.mjs`）校准。

## 主题策略

**teal 冷色系双主题**（light / dark 并重）：

- Light：冷白底（微蓝调灰，hue ≈ 220）+ teal primary（hue ≈ 195–210），muted/accent/border 为低 chroma（0.01–0.02）冷灰。
- Dark：冷深灰底 + 亮青 primary；border/input 保持半透明白（`oklch(1 0 0 / N%)`）模式。
- 主题切换：`ThemeSwitcher`（light/dark/system 三态）→ `.dark` class → CSS 变量整体翻转。持久化见 state-management（`chronolog-theme`）。

## 表面层级（底—面两级）

页面底与模块面分层（任务 08-31-layout-visual-hierarchy，Linear 风轻卡片体系的基础）：

- **Light**：`--background`（L≈0.975，冷白微灰页面底）< `--card`（L≈0.995）< `--popover`（纯白 L=1.0）——卡片在灰底上呈「纸面」感；`--sidebar`（L≈0.965）略深于页面底。
- **Dark**：`--background`（L≈0.165）< `--sidebar`（L≈0.19）< `--card` / `--popover`（L≈0.225）——暗底上的亮一档模块面，分层主要靠 hairline 边框（`--border` 半透明白）。
- 两主题下 popover 永远浮于最上层（light 纯白 / dark 与 card 同档但靠边框区分）。

## 阴影

`--shadow-xs`（`:root` / `.dark` 各一套）：light `0 1px 2px 0 rgb(0 0 0 / 0.04)`、dark `0 1px 2px 0 rgb(0 0 0 / 0.3)`，经 `@theme inline` 映射**覆盖 Tailwind 默认 `shadow-xs` 刻度**，组件直接用 `shadow-xs` 工具类。仅用于卡片表面（`ui/card`），感知为「分层」而非「浮起」；dark 下近乎不可见，主要靠 hairline 边框分层。禁止给卡片叠加更大的阴影刻度。

## 语义 token

保留 shadcn 变量命名（`--background`、`--primary`、`--muted` 等），经 `@theme inline` 映射为 `--color-*` 供 Tailwind 使用（`bg-primary`、`text-muted-foreground`…）。规则：

- 组件一律消费语义 class，不写裸色值。
- `--ring` 跟随 primary；sidebar 系列与 background 同族（light 下略深于 background、dark 下略亮一档，均介于 background 与 card 之间——见「表面层级」）。
- `--destructive` 保持红色系（hue 22–27）。
- 语义 token 配对（如 primary × primary-foreground）必须满足 WCAG AA（4.5:1），改动后用对比度脚本验证。

## 分类色板

`--category-1..8`（styles.css 内 `:root`（light）与 `.dark`（dark）各一套）：

- light 亮版（L≈0.74、C≈0.09）、dark 暗版（L≈0.58、C≈0.08），柔和低饱和，色相均衡绕色环分布（15/50/100/135/250/285/315/345，暖4冷4），两套保持同色相。
- **185–225 hue 区间留给 primary**，分类色避开，防止混淆。
- 每色配套 `--category-N-foreground`（light 下深色文字、dark 下近白略带色相），随主题翻转；Timeline 色块文字/派生色（tag 徽章底、running 轮廓）消费它。
- `web/src/format.ts` 仅持有 token 名：`categoryIndex(name)`（hash → 0–7）+ `categoryColor(name)` 返回 `var(--category-N)`。具体数值只在 styles.css 一处定义，无需两边同步。
- 分类/标签颜色可落库（`color` = 1–8 色板索引，任务 08-30-category-tag-color-palette）：展示位用 `paletteColor(color, fallbackName)` / `paletteForegroundColor(color, fallbackName)`（format.ts）——显式色优先返回 `var(--category-N)`，NULL 回退 hash 色（旧数据兼容）。**创建即固定**（任务 08-30-palette-auto-to-fixed）：新建时前端用 trim 后名称 hash（`categoryIndex(name)+1`）作为 color 随 POST 落库，编辑色板 8 色点必选其一（无「自动」选项）；旧 NULL 数据编辑时默认选中 hash 回退色、保存固化。**`categoryIndex`/`categoryColor` hash 逻辑不可改动**，否则既有回退映射漂移。色板 UI 复用 `web/src/components/ColorPalettePicker.tsx`（8 色点，radiogroup），编辑浮窗复用 `NameColorEditPopover.tsx`。
- Timeline 时间块底色用 `color-mix(in srgb, <categoryColor> 80%, transparent)` 半透明透出轨道背景；小色点/条形（picker、列表、Stats）用实色 `categoryColor()`。

## 圆角

`--radius: 0.625rem`，派生 `--radius-sm/md/lg/xl`（calc 加减）。组件用 `rounded-*` 工具类，不写裸 px。

## 排版

- `--font-sans`：系统栈 + 中文回退（Noto Sans SC / PingFang SC / Microsoft YaHei）。
- `--font-mono`：ui-monospace 系统栈，用于时长 / 时刻等数字场景，配 `tabular-nums`。
- 正文默认 `text-foreground`（body 上 `@apply`）；小号刻度文字 12px、tag 徽章 11px（见 Timeline CSS）。

Type scale（任务 08-31 固化，用 Tailwind 尺寸类表达，不引入新变量）：

| 角色 | 类 |
|------|----|
| 页面标题（Shell 顶栏 h1） | `text-xl font-semibold tracking-tight` |
| Section 标签 / 卡片标题 | `text-sm font-medium`（`CardTitle` 为 `text-sm font-semibold`） |
| 正文（表格、表单默认） | `text-sm` |
| 辅助 / 元信息 | `text-xs text-muted-foreground` |
| 大数字（统计总时长） | `font-mono text-3xl font-bold tabular-nums` |
| 数字常规（时长 / 时刻） | `font-mono tabular-nums` |

## 间距

页面布局用 Tailwind 间距工具类；不做全局 spacing token 自定义。页面内容统一经 `PageContainer` 承载（`p-4 md:p-6` + default/wide/full 三档限宽，见 component-guidelines）；内容模块（Card）间距 `space-y-6`；卡片内边距紧凑档 `p-4` 系（CardHeader / CardContent / CardFooter 默认），大数字卡、独立表单卡可用 `p-6`。视觉分组靠轻卡片模块 + spacing；页面顶栏、Timeline 工具栏等条带仍用 `border-b` hairline 分层。

## 禁止事项

- 不在组件里硬编码 hex / rgba 颜色（destructive 语义色等经 token 引用除外）。
- 叠在彩色色块上的前景（tag 徽章底、running 轮廓）用 `color-mix(in srgb, currentColor N%, transparent)` 从色块文字色派生，不用白色硬编码。例外：`timeline-pulse` 阴影画在色块外的页面背景上，不从文字色派生（dark 下深色文字不可见），改用 `color-mix(var(--ring) N%, transparent)`。
- 分类色已按 per-theme 双套定义（light 亮版 / dark 暗版 + 各自 foreground），色相不变。