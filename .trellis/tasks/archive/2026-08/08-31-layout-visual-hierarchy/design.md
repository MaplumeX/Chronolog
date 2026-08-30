# 技术设计：重构整体布局结构与视觉层级（Linear 风 · 轻卡片化 A2）

## 1. 架构与边界

纯前端视觉/布局重构，边界清晰：

| 层 | 文件 | 职责 |
|----|------|------|
| Token 层 | `web/src/styles.css` | 新增/微调：表面层级、阴影 token、type scale 相关变量；唯一视觉值定义源 |
| 共享组件层 | `web/src/components/ui/card.tsx`（新建）+ `Shell.tsx` | 轻卡片原语 + 骨架（侧栏/顶栏/内容容器） |
| 页面层 | `web/src/pages/*.tsx`、`TimerBar.tsx`、`Timeline.tsx` | 套用新骨架与卡片，不改逻辑 |
| Spec 层 | `.trellis/spec/frontend/{component-guidelines,design-tokens}.md` | 推翻 no-card 约定，落地新规范 |

不动：`App.tsx` 的页面装配逻辑（除 header 标题层级相关 class）、`api.ts`、hooks、i18n、后端。

## 2. Token 设计（styles.css）

### 2.1 表面层级（底—面两级）

现状 light 下 `--background` 与 `--card` 同值（`oklch(0.985 0.005 220)`），模块无法从页面底浮出。调整：

- **Light**：`--background` 略降明度（冷白微灰，如 L≈0.975），`--card`/`--popover` 升至纯白附近（L≈1.0 或 0.995）→ 卡片在灰底上呈现「纸面」感。
- **Dark**：`--background` 保持深底（L≈0.165），`--card`/`--popover` 略升（L≈0.21→0.225 区间微调）→ 暗底上的亮一档模块面。
- 侧栏 `--sidebar` 与 background 的关系重新核对：light 下侧栏可保持略深于 background 或与 background 同档（卡片仍在内容区浮于其上）。

### 2.2 轻卡片阴影 token

新增 `--shadow-xs`（双主题各一套），仅用于卡片表面：

- Light：`0 1px 2px rgb(0 0 0 / 0.04)` 量级，极微弱弥散，感知为「分层」而非「浮起」。
- Dark：黑色阴影在深底上几乎不可见，改用 `0 1px 2px rgb(0 0 0 / 0.3)` 或近乎省略，主要靠 hairline 边框（`--border` 半透明）分层。

实现方式：在 `@theme inline` 内映射 `--shadow-xs: var(...)`，组件用 `shadow-xs` 工具类（Tailwind v4 自带 `shadow-xs`/`shadow-sm`，若默认刻度不合则用自定义 token 覆盖 `--shadow-xs`）。

### 2.3 Type scale

不引入新 CSS 变量（Tailwind 尺寸类足够），但在 spec 中固化层级约定：

| 角色 | 类 | 说明 |
|------|----|------|
| 页面标题（顶栏 h1） | `text-xl font-semibold tracking-tight`（现 `text-lg`） | 顶栏 `min-h-12` 若局促可调至 `h-14` |
| Section 标签 | `text-sm font-medium`（现多为 `text-sm text-muted-foreground`） | 卡片标题/区块名 |
| 正文 | `text-sm`（表格、表单默认） | |
| 辅助/元信息 | `text-xs text-muted-foreground` | |
| 大数字 | `font-mono text-3xl font-bold tabular-nums`（统计总时长，保持） | |
| 数字常规 | `font-mono tabular-nums`（时长/时刻，保持） | |

### 2.4 间距 / 圆角

- `--radius: 0.625rem` 保持；卡片统一 `rounded-lg`（= radius）。
- 页面容器内边距统一为 `p-6`（现为各页散装 `px-6 py-6`，收敛到共享容器组件）；卡片内边距按密度 `p-4` 或 `p-6` 两档，spec 固化。
- 卡片间距 `gap-6`（或 `space-y-6`）。

## 3. 共享原语

### 3.1 `ui/card.tsx`（新建，shadcn new-york 风格）

标准 shadcn Card 六件套：`Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`，样式收敛为：

- `Card`：`rounded-lg border bg-card text-card-foreground shadow-xs`
- `CardHeader`：`flex flex-col gap-1 p-4`（紧凑档；spec 允许 `p-6` 变体）
- `CardTitle`：`text-sm font-semibold`（非 shadcn 默认大标题——我们的卡片是模块容器不是英雄卡）
- `CardContent`：`p-4 pt-0`（或 `px-6 pb-6` 档）

获取方式：参考 shadcn new-york card 源码手写（项目无 `shadcn add` 的 CI 依赖，手写单文件即可），与现有 `ui/*` 组件同构（`cn()` + `data-slot`）。

### 3.2 页面容器 `PageContainer`（新建小组件或 Shell 内联）

内容区居中限宽的统一载体：

```tsx
// web/src/components/PageContainer.tsx
export function PageContainer(props: {
  size?: "default" | "wide" | "full"; // default=max-w-3xl? wide=max-w-5xl, full=不限
  children: ReactNode;
}) => (
  <div className={cn(
    "mx-auto w-full p-6",
    props.size === "wide" ? "max-w-5xl" : props.size === "full" ? "max-w-none" : "max-w-3xl",
  )}>
    {props.children}
  </div>
);
```

宽度档位（初定，实现时可微调）：
- `default`（max-w-3xl）：Settings、Auth（Auth 自带 max-w-sm，不用容器）
- `wide`（max-w-5xl）：Stats、Goals、Categories、Tags
- `full`：Timeline（横向滚动与刻度需要全宽；仅套用 `p-*` 统一，不做限宽居中）

### 3.3 页面工具栏

不新建组件——工具栏就是页面容器内第一个 `flex items-center gap-2` 行（Tabs / 筛选 / `ml-auto` 主操作按钮）。Spec 固化模式：主操作（如「新建目标」）永远 `ml-auto` 靠右；筛选控件靠左。

## 4. Shell 精修

### 4.1 侧栏
- `SidebarHeader` 品牌区：logo 块（`size-8 rounded-md bg-sidebar-primary`）+ 名称保持不变，微调 padding 使视觉居中。
- Nav 项：active 态保持 `bg-sidebar-accent`，核对 icon/文字间距与 `SidebarMenuBadge`（计时 elapsed）对齐；`SidebarGroupLabel` 保持 uppercase tracking-wide（Linear 风典型）。
- Footer：用户行 + 设置行间距微调。
- 结构与行为（collapsible、mobile drawer、SidebarRail）零改动。

### 4.2 顶栏
- `min-h-12` → 评估是否升至 `h-14`（配合更大页面标题）；TimerBar 在 Timer 页占满顶栏，其高度随内容自适应（保持 `min-h` 语义）。
- 非 Timer 页 `h1`：`text-lg font-semibold` → `text-xl font-semibold tracking-tight`，`px-2` 保持。
- `border-b` 保持 hairline。

### 4.3 内容区
`SidebarInset` 内的滚动容器（`flex min-h-0 flex-1 flex-col overflow-auto`）保持；页面内容改为包在 `PageContainer` 里（App 不动，各页面自行包裹——各页 size 不同，放在页面层更灵活）。

## 5. 页面级改造

### 5.1 StatsPage（wide）
```
PageContainer(wide)
├─ 工具栏行：range Tabs + [custom 日期 Popover] + ml-auto tag 筛选 Dropdown
├─ Card（总时长）：CardContent p-6 → label(text-sm muted) + 大数字(mono 3xl bold)
├─ Card（每日趋势）：CardHeader(title) + CardContent(BarChart h-56)
├─ Card（分类占比）：CardHeader(title + ml-auto 独立/汇总 toggle) + CardContent(donut + 明细列表)
└─ Card（标签明细，条件渲染）：CardHeader(title) + CardContent(CSS bars)
```
现有总时长卡（plain `rounded-lg border` div）迁移为标准 Card。

### 5.2 GoalsPage / CategoriesPage / TagsPage（wide）
```
PageContainer(wide)
├─ 工具栏行：Categories/Tags 为创建 Input+按钮（靠左）；Goals 为 ml-auto 新建按钮
└─ Card：Table 直接作为 Card 内容（CardContent p-0，表格自带行分割线；表头与卡片顶边对齐）
```
表格入卡的关键：`CardContent className="p-0"`，Table 首行/末行圆角与卡片 `rounded-lg overflow-hidden` 处理（overflow-hidden 裁剪即可）。

### 5.3 SettingsPage（default）
Tabs 保持；每个 tab 内表单分组各成 Card：
- 通用：一张 Card（语言行 + 主题行）
- 账户：资料 Card、修改密码 Card、危险区 Card（logout + delete；危险区可考虑 `border-destructive/30` 轻提示，spec 定）
- API Tokens：TokensPage 嵌入其 Card 结构（TokensPage 内部同步套用）

### 5.4 AuthPage
保持 `grid min-h-dvh place-items-center` + `max-w-sm`；Tabs 容器套 Card（表单区成为卡片），视觉与新体系一致。

### 5.5 计时页（TimerBar + Timeline）
- `TimerBar`：输入框/选择器/时间/按钮行的间距精修；保持顶栏内嵌形态，不加卡片壳。
- `Timeline`：工具栏行（day/week Tabs、缩放、DateNav、总时长）保持 `border-b` 条带但精修间距与字号层级；Timeline 本体（ruler/色块/now-line/gap slot）零改动；容器 `size="full"`。

## 6. 数据流与契约

无变化。所有 props、API、state 管理保持原样。唯一组件级新契约：`Card` 六件套与 `PageContainer` 的 props（见 §3）。

## 7. 兼容性与迁移

- 视觉 Breaking Change 是有意的（用户要求）；无需数据迁移。
- `TokensPage` 嵌入 Settings，随 Settings 一并改造。
- 移动端：卡片 `p-4` 档 + `PageContainer` 的 `p-6` 在窄屏可降至 `p-4`（用 `p-4 md:p-6`）。
- i18n：不新增文案 keys（纯布局）；若加 section 标题需补 zh/en 双份。

## 8. 关键取舍

- **推翻 no-card 约定**：A2 的核心代价。旧约定动机是「避免浮起白卡的臃肿感」；新体系通过 hairline + 微弱阴影 + 低对比表面差保持轻盈，同时获得模块边界。spec 修订时必须写清新约定的「轻」约束（禁大阴影、禁高对比卡片、radius 统一）。
- **Card 六件套 vs 单个容器类**：选六件套——与 shadcn 生态对齐，后续 shadcn 组件（如 chart 示例）天然兼容；代价是多一个文件。
- **页面标题放大但留在顶栏**：不做页面内 hero 标题区（那会更 Notion 风）；顶栏标题放大是 Linear 的最小足够表达。
- **Timeline 不动本体**：色块体系刚经过多轮打磨（gap slot、拖拽、双主题色板），重排风险远大于收益。

## 9. 回滚

单分支单 PR；回滚 = revert commit。无持久化状态变更，回滚零成本。分步实现时每步可独立 typecheck，出问题回退到上一 checklist 项。

## 10. 验证

- `cd web && npm run typecheck`（= build 的 tsc 部分）每次改动后跑。
- `npm run build` 最终验证。
- 人工双主题 × 6 页面 × 桌面/移动视口核对（AC5/AC6）。
- 硬编码颜色 grep：`grep -rn "oklch\|#[0-9a-fA-F]\{3,\}\|rgba\?(" web/src --include="*.tsx" | grep -v "var(--"` 应只剩既有例外。
