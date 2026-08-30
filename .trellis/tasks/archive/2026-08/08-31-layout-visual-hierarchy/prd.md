# 重构整体布局结构与视觉层级

## Goal

将 Chronolog 全应用（Shell 骨架 + 全部 6 个页面 + Auth 页）重构为 **Linear 风 · 轻卡片化（A2）** 的视觉体系：冷静、秩序、精致的工具感，保留 teal 冷色双主题品牌资产。核心价值是提升视觉层级与精致度，不改变任何功能行为与数据流。

**设计解读（Design Read）**：生产力工具 Web 应用，面向个人用户，采用 Linear 式极简秩序语言 —— 超低饱和中性色阶、单一 teal 强调、发丝边框（hairline）、克制的轻卡片模块（细边框 + 极微弱阴影，非浮起白卡）、拉开的字号层级（大标题 + 13/14px 正文）、mono 数字强调。

## Background / Confirmed Facts

- 现状骨架：`Shell.tsx` = `SidebarProvider` + `Sidebar collapsible="icon"` + `SidebarInset`；顶栏 `min-h-12 border-b` = `[SidebarTrigger][header]`；Timer 页 header 为 `TimerBar`，其余页 header 为 `<h1 class="text-lg font-semibold">`。
- 各页面内容区均为 `px-6 py-6`，无宽度约束，宽屏下内容拉伸；视觉分组目前靠 spacing + `border-b` + surface 色。
- 现有 spec（`.trellis/spec/frontend/component-guidelines.md` / `design-tokens.md`）明确**禁止卡片化页面容器**（"No elevated white cards as page chrome"、"Do not wrap pages in shadcn Card"）。本任务选择 A2 即意味着**推翻该约定**，Phase 3.3 必须同步修订这两份 spec。
- 主题体系：`styles.css` `:root` / `.dark` 双套 oklch token，shadcn 变量命名；`--radius: 0.625rem`；teal 冷色系（light hue≈220 冷白底 / dark 冷深灰底）。
- 页面清单：`AuthPage`（max-w-sm 居中表单）、`TimerBar`+`Timeline`（计时页）、`StatsPage`（图表+列表）、`GoalsPage`（表格）、`CategoriesPage` / `TagsPage`（层级表格）、`SettingsPage`（Tabs 表单）。
- 无 React Router（`PageId` state 切换）、无 Card 组件（未 `shadcn add card`）、i18n 全覆盖（zh/en）、Lucide 唯一图标集、recharts 唯一图表库。

## Requirements

### R1 · 设计 token 层（styles.css）
- R1.1 在 teal 冷色基调上微调中性色阶与表面层级：区分 `background`（页面底）与 `card`/surface（模块面），light 下模块面比页面底更亮、dark 下更亮一档，形成「底—面」两级层次。
- R1.2 定义轻卡片表面规范：hairline 边框（现 `--border`）+ 极微弱弥散阴影 token（如 `--shadow-xs`，双主题各一套，dark 下阴影近乎不可见仅靠边框分层）。
- R1.3 建立明确字号层级（type scale）：页面标题（顶栏 `h1`）提升为更醒目的层级；section 标签、正文、辅助文字、数字（mono + tabular-nums）各级尺寸/字重/颜色（foreground vs muted-foreground）有清晰分工。
- R1.4 保持全部语义 token 配对 WCAG AA（4.5:1），改动后验证。

### R2 · Shell 骨架
- R2.1 侧栏视觉精修：品牌区（logo + Chronolog）、nav 项（icon + 文字 + active 态层级）、footer（用户 + 设置）的间距/字号/active 背景更克制精致；保持 `collapsible="icon"` 行为与移动端 Sheet drawer 不变。
- R2.2 顶栏精修：保持 `[SidebarTrigger][header]` 结构；非 Timer 页页面标题层级提升（更大字号 + 更清晰的字重对比），Timer 页 TimerBar 与顶栏融合更自然。
- R2.3 内容区骨架：引入**居中限宽容器**——页面内容在内容区内水平居中并设最大宽度（按页面性质分档：表单/表格类较窄，统计/时间线类较宽），宽屏不再无界拉伸；时间线等需要横向空间的视图可例外。

### R3 · 页面级布局重构（轻卡片模块）
- R3.1 建立统一的页面内部结构：页面标题区（顶栏）→ 工具栏/操作区（filters、主操作按钮）→ 内容模块区（轻卡片承载图表、表格、表单分组）。
- R3.2 `StatsPage`：总时长卡、趋势图卡、分类占比卡（含 donut + 明细）、标签明细卡成为独立轻卡片模块；range Tabs / tag 筛选归入工具栏区。
- R3.3 `GoalsPage` / `CategoriesPage` / `TagsPage`：表格置于轻卡片容器内（表头与卡片边界对齐，行分割线保留）；「新建」主操作归入页面工具栏区。
- R3.4 `SettingsPage`：Tabs 保留；各 tab 内的表单分组（资料 / 密码 / 危险区等）成为轻卡片模块。
- R3.5 `AuthPage`：登录/注册表单容器视觉精修（与新的轻卡片体系一致），保持 `max-w-sm` 居中。
- R3.6 计时页：`TimerBar` 精修（与顶栏融合）；`Timeline` 的 day/week 工具栏（视图切换、缩放、日期导航、总时长）视觉层级统一；Timeline 本体保持功能布局不变，仅精修工具栏与容器（横向滚动需要，不做居中限宽或做特殊处理）。

### R4 · 通用约束
- R4.1 不改变任何功能行为、数据流、API 调用、交互逻辑（纯视觉/布局重构）。
- R4.2 light / dark 双主题同等质量，逐一核对。
- R4.3 移动端（<768px）与桌面端均验证；侧栏 drawer 行为不变。
- R4.4 全部颜色消费语义 token，禁止硬编码 hex/rgba；新视觉值集中在 `styles.css` 定义。
- R4.5 不引入新依赖；图标仍只用 Lucide；UI 文案仍全部走 i18n。
- R4.6 不引入 React Router、不换图表库、不改 `categoryIndex`/`categoryColor` hash 逻辑。

## Out of Scope

- 功能新增 / 交互重做 / 信息架构（IA）变更（导航项、页面集合不变）。
- 后端任何改动。
- 品牌重塑（logo、应用名、主色 teal 不变；非 A 方向的全局重设计）。
- 营销页 / landing page。
- 动效体系重做（保留现有 tw-animate-css 与 Dialog fade-only 约定）。

## Acceptance Criteria

- [ ] AC1（视觉层级）：每个页面有清晰的「页面标题 → 工具栏 → 内容模块」层级；页面标题不再是小号 `text-lg`，层级对比一眼可辨。
- [ ] AC2（轻卡片体系）：统计/目标/分类/标签/设置各页的内容模块以统一轻卡片（hairline 边框 + 微弱阴影 + 统一 radius/内边距）呈现；卡片样式来源唯一（共享 class/token，非各页散装）。
- [ ] AC3（限宽居中）：宽屏（≥1280px）下表单/表格/统计页内容居中且有最大宽度，两侧留白；时间线视图不被压窄。
- [ ] AC4（token 合规）：`grep` 各改动文件无新增硬编码颜色；新视觉值仅在 `styles.css` 定义；语义 token 配对 AA 对比度通过。
- [ ] AC5（双主题）：light/dark 下所有页面逐一人工核对无违和（边框可见、阴影层次正确、文字对比正常）。
- [ ] AC6（功能回归零）：`npm run typecheck`（web）通过；计时启动/停止、条目编辑、拖拽创建、统计切换、目标 CRUD、设置保存等关键路径人工冒烟不回归。
- [ ] AC7（spec 同步）：`component-guidelines.md` 与 `design-tokens.md` 中 no-card 相关约定已修订为新的轻卡片规范，不留自相矛盾的旧条款。

## Key Decisions

- D1：方向 = **Linear 风 · 轻卡片化（A2）**，推翻现有 no-card 约定（用户 2026-08-31 明确选择 A2 而非保留扁平的 A1）。
- D2：保留 teal 冷色双主题、`--radius` 体系、shadcn 变量命名 —— 重构是「精修」不是「换皮」。
- D3：卡片样式通过共享机制（`ui/card` 组件或统一样式类）实现，禁止各页自行拼装 border/rounded/shadow。
- D4：Timeline 本体（色块/刻度/拖拽）不做结构性改动，仅容器与工具栏纳入新体系。

## Risks / Deferred

- 风险：A2 与现有 spec 冲突面广 —— 缓解：实现后 Phase 3.3 强制修订两份 spec（AC7 兜底）。
- 风险：限宽对 Timeline 横向滚动的影响 —— 设计阶段给出 Timeline 容器特例方案。
- 延后：阴影/动效的更细腻打磨（如 hover 浮起）视实现后效果再定，不做承诺。
