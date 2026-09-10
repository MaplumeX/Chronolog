# Chip-based category and tag pickers

## Goal

把分类 / 标签的选择方式从「下拉菜单」改为「彩色胶囊平铺」，让常用项一次点击即可选中，
消除「点开 → 找 → 点」的三步操作；桌面端顶栏（TimerBar）改为双行布局承载胶囊带。

用户价值：开始计时 / 编辑条目时选分类标签的操作成本从 3 步降到 1 步；分类色成为主视觉，
选中状态一眼可辨。

## Background（仓库证据）

当前实现（全部为 shadcn `DropdownMenu` 触发器 + 菜单项）：

- `web/src/components/CategoryPicker.tsx` — 单选，`DropdownMenuTrigger` 是一个 outline Button
  （色点 + label）；菜单内两级层级靠 `pl-7` 缩进 + `h-3 w-px bg-border` 引导线；选中项 `bg-accent`。
  支持受控 `open` / `onOpenChange`（09-08 连续计时自动弹出用）。
- `web/src/components/TagPicker.tsx` — 多选，同样结构，选中项额外显示 `Check` 图标；
  触发器 label 由调用方拼成「A、B、C」字符串（`timer.tagSeparator`）。
- 调用方共 3 处：
  - `web/src/components/EntryEditor.tsx:182,192` — 编辑器内 `Label` + picker 竖排。
  - `web/src/hooks/use-timer-controller.tsx:327,343` — 组装成 `barProps.categoryPicker` /
    `barProps.tagPicker` 两个 ReactNode 插槽。
  - 插槽被 `TimerBar`（桌面顶栏）与 `MobileTimerDock`（移动 sheet）双端消费。
- 桌面顶栏：`App.tsx:122` 把 `<TimerBar>` 传给 `Shell` 的 `header` 插槽；
  `Shell.tsx:226` 的桌面 header 是 `flex min-h-12 items-center border-b px-2` 单行。
- 移动端：`Shell.tsx:157` 分支不渲染 TimerBar，改渲染页面标题 + `MobileTimerDock`（底部停靠胶囊
  + bottom sheet），sheet 内部复用同两个 picker 插槽。
- 运行中标签特例（`TimerBar.tsx:31-50`）：计时中且有标签时，`tagPicker` 插槽被只读徽章行替换。

数据与配色（无需改后端）：

- `Category` / `Tag`（`web/src/api.ts:15,25`）均带 `entryCount: number`、`parentId: string | null`；
  `Category` 另有 `archivedAt`。
- 排序 / 过滤工具已存在：`web/src/hierarchy.ts` 的 `sortHierarchical()`、`filterActive()`。
- 配色：`paletteColor(color, fallbackName)` / `paletteForegroundColor(...)`（`web/src/format.ts:217,224`），
  返回 `var(--category-N)` / `var(--category-N-foreground)`；分类色板 `--category-1..8` 双主题双套。
- 归档兜底：`EntryEditor` 用后端 `categoryName` 兜底显示归档分类（`EntryEditor.tsx:69`），
  保存时后端换绑归档分类会 409。

现有测试（需适配）：`CategoryPicker.test.tsx`(142) / `EntryEditor.test.tsx`(229) /
`MobileTimerDock.test.tsx`(210) / `Shell.test.tsx`(174)；`TagPicker` 无独立测试。

## Requirements

### R1 胶囊基元（新建共享组件）

新建 `web/src/components/ChipGroup.tsx`，作为分类 / 标签胶囊的唯一渲染基元。

- **R1.1** 纯展示组件：不 import `api`、不含 `t()` 调用（文案由调用方传入），
  与 `ConfirmDialog` / `HierarchicalListCard` 同样的「无业务逻辑」契约。
- **R1.2** 单个胶囊是 `<button type="button">`，`rounded-full`、`text-xs`，
  内含色点（`size-1.5 rounded-full`，`paletteColor(color, name)`）+ 名称。
- **R1.3** 选中态视觉按类型区分（D1 的「分类实心 / 标签描边」）：
  - 分类选中 = 实色填充（`paletteColor` 作 background + `paletteForegroundColor` 作文字色）；
  - 标签选中 = 彩色描边 + 淡色底（`color-mix` 派生，不硬编码白色）；
  - 未选中 = 中性 outline（`border-input` + `text-foreground`）。
- **R1.4** 容器为 `flex flex-wrap gap-1.5`（D4 自然折行）。
- **R1.5** 触屏适配：`@media (hover: none)` 下命中区 ≥40px，复用现有 `.touch-hit` 机制，
  不改胶囊视觉尺寸。
- **R1.6** 无障碍：单选组胶囊 `aria-pressed` 表达选中态；`disabled` 胶囊（D7）
  同时设 `aria-disabled` 且不可聚焦触发。

### R2 CategoryPicker 重写（单选）

重写 `web/src/components/CategoryPicker.tsx`，删除全部 `DropdownMenu` 代码。

- **R2.1** 渲染为两段式胶囊组（D3）：父级行常驻（仅顶层节点），
  子级行仅在对应父级展开时渲染。数据源为 `sortHierarchical(props.categories)`，
  顺序不变（D5）。
- **R2.2** 点击父级胶囊 = 同时触发「选中该父级」与「展开其子级行」（单次点击两个效果）。
- **R2.3** 展开态为组件内部 state，同时最多一个父级处于展开态（手风琴语义）；
  它不受控、不持久化。当 `value` 指向某个子级时，其父级默认展开（派生初值）。
- **R2.4** 子级行带视觉归属标识（缩进 / 引导线），澄清它属于哪个父级。
- **R2.5** 归档只读胶囊（D7）：新增可选 prop 接收「当前值不命中候选集」时的显示名，
  为空则不渲染该胶囊。调用方负责判定与传值。
- **R2.6** 删除 `open` / `onOpenChange` 受控 props（D4）；改为接收引导脉冲信号 prop（D8）。
- **R2.7** 保留现有 `disabled` prop 语义（整组禁用）。

### R3 TagPicker 重写（多选）

重写 `web/src/components/TagPicker.tsx`，删除全部 `DropdownMenu` 代码。

- **R3.1** 同 R2.1–R2.4 的两段式结构与顺序契约，数据源为 `sortHierarchical(props.tags)`。
- **R3.2** 点击胶囊 = toggle（选中↔取消），区别于分类的单选不可取消。
- **R3.3** 父级胶囊的点击同时 toggle 自身与展开子级行；取消选中父级**不**连带取消子级
  （标签无级联语义，与现有 `TagPicker` 行为一致）。
- **R3.4** 子级行在其父级收起后仍保留已选中的子级可见性：若某子级已选中，
  其父级默认展开（同 R2.3 派生初值规则），避免已选项被隐藏。
- **R3.5** 空标签列表时渲染现有 `tags.empty` 文案（不新增 i18n key）。
- **R3.6** 删除调用方拼接的 label 字符串机制：`label` prop 下线，
  `timer.selectTags` / `timer.tagSeparator` 两个 i18n key 随之废弃（从 zh/en 移除）。

### R4 桌面双行 header

改造 `web/src/components/TimerBar.tsx` 为双行布局（D2）。

- **R4.1** 第一行：描述输入（`flex-1`）+ 已计时时长（`font-mono text-xl tabular-nums`）
  + 圆形开始/停止按钮（`size-11 rounded-full`）——即现有第一行去掉两个 picker 插槽。
- **R4.2** 第二行：分类胶囊组 + 标签胶囊组，两组需有可辨的视觉分隔（分隔线或间距）；
  分类在左、标签在右。
- **R4.3** `Shell.tsx:226` 桌面 header 的 `min-h-12 items-center` 需适配多行内容
  （改为 `items-start` 或等价方案），且 `SidebarTrigger` 不能被拉伸变形；
  非 timer 页的单行大标题 header 渲染不得受影响。
- **R4.4** header 高度随胶囊折行渐进增长（D4）；下方 Timeline 区域自适应副余高度，
  不得出现页面级滚动条或 Timeline 被截断。
- **R4.5** 删除运行中只读标签徽章行分支与 `runningTags` / `runningTagColors` props（D6）。
- **R4.6** `TimerBar` 保持纯展示组件（无 `api` import），胶囊组仍以 ReactNode 插槽形式
  由 `useTimerController` 传入，保持现有装配边界。

### R5 移动端（MobileTimerDock）

- **R5.1** sheet 内直接复用同两个胶囊组插槽，不另做瓦片网格布局（共享 R1 基元）。
- **R5.2** 删除 `MobileTimerDock.tsx:126-149` 的运行中只读标签徽章行分支及
  `runningTags` / `runningTagColors` props（D6，与 R4.5 同步）。
- **R5.3** 底部停靠胶囊（常驻条）不变：仍为分类色点 + 描述摘要 + 时长 + 开始/停止按钮，
  不在停靠条上放胶囊组（空间不足，且会与 Tab 栏挤压）。
- **R5.4** 连续计时 sheet 自动开启链路保持不变：`open = manualOpen || autoOpenEditor`
  的纯派生实现不得改为 useEffect 同步；`onAutoOpenConsumed` 语义保留。
- **R5.5** 胶囊命中区在 sheet 内满足触屏可点性（同 R1.5）。

### R6 EntryEditor 适配

- **R6.1** 分类 / 标签两处 `Label` + picker 的结构保留，仅 picker 内部形态改变。
- **R6.2** 实现 D7 归档只读胶囊：编辑模式下当 `categoryId` 不命中
  `filterActive(props.categories)` 时，把 `props.entry.categoryName` 传给 R2.5 的新 prop。
- **R6.3** 保存按钮的 `disabled={categoryId === ""}` 守卫保留；归档只读胶囊不算有效选择，
  用户必须改选活动分类才能保存（避免服务端 409）。
- **R6.4** 删除 `tagPickerLabel` 拼接逻辑（R3.6）与 `categoryLabel` 中仅为触发器服务的部分。
- **R6.5** 移动 sheet 内的按钮布局（标题行 / 合并行 / 主按钮行）不变。

### R7 连续计时引导脉冲（D8）

- **R7.1** `useTimerController` 的 `categoryPickerAutoOpen` 重命名为引导语义
  （如 `categoryHintActive`），并同步更新 `barProps.autoOpenEditor` /
  `onAutoOpenConsumed` 的注释与语义说明；信号置位 / 复位时机不变。
- **R7.2** 新增 CSS 键帧（`styles.css`）实现有限时长 ring 脉冲，参照
  `@keyframes timeline-pulse`（`styles.css:566`）的 `box-shadow` +
  `color-mix(in srgb, var(--ring) N%, transparent)` 写法；禁止硬编码色值。
- **R7.3** 动画不得 `infinite`；信号被消费（选中分类 / 用户关 sheet）后停止。
- **R7.4** 不新增任何 i18n 文案、不新增提示条 UI 元素。

### R8 测试适配

- **R8.1** `CategoryPicker.test.tsx` 重写：dropdown 展开类用例（`menuitem` 角色、
  radix portal 清理、`PointerEventsCheckLevel.Never`）全部失效，改为直接断言胶囊按钮；
  新增：两段式展开（R2.2/R2.3）、归档只读胶囊（R2.5）、选中态配色（R1.3）。
- **R8.2** 新增 `TagPicker.test.tsx`（现无独立测试）：覆盖 toggle、父级取消不连带子级
  （R3.3）、已选子级导致父级默认展开（R3.4）。
- **R8.3** `MobileTimerDock.test.tsx` 移除 `runningTags` / `runningTagColors` 夹具与
  第 126 行的只读徽章用例（D6）；保留 sheet 派生开启用例（R5.4）。
- **R8.4** `EntryEditor.test.tsx` 中依赖 picker 下拉交互的用例改为胶囊点击。
- **R8.5** 新增 `ChipGroup` 的代表性 smoke 测试（深度 A 范围，不做快照）。

### 已确认的设计决策

- **D1** 采用方案 B（彩色胶囊平铺），非 combobox / Miller 列 / 内联语法。
- **D2** 桌面 header 采用 **B1 双行布局**：第一行描述输入 + 计时 + 播放按钮，第二行胶囊带。
- **D3** 两级层级采用**两段式**表达（非全扁平路径前缀、非分组换行）：
  - 父级行常驻，只渲染顶层节点胶囊；
  - 点击父级胶囊 = 选中该父级 **且** 展开其子级行；
  - 子级行仅在其父级处于展开态时渲染，点子级胶囊选中子级；
  - 父级与子级本身都可被选中（沿用现有「每个 level 都 selectable」契约）；
  - 该结构与 `hierarchy.ts` 的 `sortHierarchical()` 返回的 `{ parent, children }[]` 一一对应。
  - 权衡：选子级需 2 次点击（仍比原下拉少 1 步），换取父级行宽度可控、双行 header 高度稳定。
- **D4** 溢出策略采用**自然折行**（`flex-wrap`），无数量上限、无隐藏项：
  - 不保留任何 `DropdownMenu` 兜底路径——胶囊是**唯一**渲染形态，
    `CategoryPicker` / `TagPicker` 内的 dropdown 代码整条删除（含受控 `open`/`onOpenChange`；
    09-08 连续计时的自动弹出链路改由 D8 的引导脉冲承接）；
  - 桌面 header 第二行高度随顶层节点数量渐进增长，不做截断；
  - 移动 sheet 内由 sheet 自身的 `max-h-[85dvh] overflow-y-auto` 承接。
  - 依据：顶层节点由用户在管理页手建，天然数量可控（默认仅 4 个）；
    分类归档（`filterActive()`）已提供产品级收纳出口。
- **D5** 胶囊顺序 = **现有创建顺序，不引入任何频次 / 时间排序**：
  - 数据源顺序不变——`GET /api/categories` / `/api/tags` 的 `ORDER BY rowid`
    （`server/src/routes/categories.ts:92`）经 `sortHierarchical()` 保序透传；
  - 不读取 `entryCount` 做排序（字段仍存在，本任务不消费），不新增 `lastUsedAt`；
  - 依据：D4 已保证全量可见，排序不再承担「把高频顶到可见区」的作用，
    只剩位置稳定性价值；固定位置支持肌肉记忆，且与管理页
    （`HierarchicalListCard`）、原下拉菜单的顺序完全一致，无需重建心智模型。
  - 用户调整顺序的现有出口：管理页重建 / 归档。
- **D6** 计时进行中，胶囊带**常驻展开且保持可编辑**，与空闲态渲染完全一致：
  - 无展开 / 收起分支，无 start/stop 带来的 header 高度跳动；
  - **删除 `TimerBar.tsx:31-50` 的运行中只读标签徽章行分支**（`runningTags` /
    `runningTagColors` 两个 props 随之下线，需清理 `barProps` 与 `MobileTimerDock`
    的同名 props）；
  - 行为增强：运行中改标签从「不可能」变为「一次点击」，走现有
    `onRunningTagsChange` → `PATCH /api/timer/current` 即时保存路径
    （`use-timer-controller.tsx:349`，08-30 edit-while-timing 已支持）；
  - 已知可接受风险：计时中误点胶囊会立即改数据；可再点回恢复，不涉及数据丢失。
  - 依据：D4 已定「胶囊是唯一形态」，只读徽章行提供的信息胶囊行已全部表达，
    保留它只会产生第二种视觉语言并剥夺一个后端已支持的能力。
- **D7** 归档 / 无匹配分类的当前值，以**追加一枚只读胶囊**表达：
  - 仅 `EntryEditor` 编辑模式、且当前 `categoryId` 不命中 `filterActive()` 结果时，
    在父级行**末尾**额外渲染一枚胶囊，文案取后端 `entry.categoryName`
    （未分类条目经 `coalesce` 为「未分类」，`server/src/entries.ts:36`）；
  - 该胶囊带 lucide `Archive` 图标 + `text-muted-foreground`，渲染为选中态但 `disabled`
    （不可点击）——用户只能点其它活动胶囊把它换掉；
  - 换掉后该只读胶囊从 DOM 移除（不保留为可回退选项）；
  - `TimerBar` / `MobileTimerDock`（新建计时场景）不适用此分支。
  - 依据：胶囊形态无触发器，当前值必须在候选行内表达；本方案是唯一同时满足
    「选择器显示当前值」（`component-guidelines.md` 已固化契约）与「不制造必然 409
    的假可用状态」的选项。
- **D8** 无间隙换段引导在桌面端重塑为**分类胶囊行短暂脉冲高亮**：
  - 信号源不变：`use-timer-controller.tsx:247` 的 `categoryPickerAutoOpen`
    （名称已不副实，重命名为引导语义而非「开关下拉」语义）；
  - **桌面**：信号为 true 时给分类胶囊行加一段有限时长（~2s）的 ring 脉冲动画，
    实现参照已有 `@keyframes timeline-pulse`（`styles.css:566`，
    `box-shadow` + `color-mix(in srgb, var(--ring) N%, transparent)`），新增同类键帧；
  - **移动**：行为不变——sheet 仍由 `open = manualOpen || autoOpenEditor` 派生打开
    （该链路不依赖 picker 的受控 `open`）；sheet 内胶囊行同样可脉冲；
  - 信号消费（选中分类 / 用户关 sheet）后动画停止，不得无限循环；
  - 不引入提示文字条、不引入新 i18n 文案。
  - 依据：换段引导是 09-08 已交付的产品行为，D4 删除受控 `open` 后桌面端会丢失该行为；
    脉冲高亮是最轻量的保留方式，无模态打断，且项目内已有同类实现可参照。

## Acceptance Criteria

### 交互行为

- [ ] **AC1** 桌面 timer 页：顶栏第二行直接可见全部顶层分类与顶层标签胶囊，
      无需展开任何菜单；点一个分类胶囊即完成选择（D1、R4.2）。
- [ ] **AC2** 点击带子级的父级胶囊后：该父级变为选中态 **且** 其子级行出现；
      点另一个父级时前一个的子级行收起（同时最多一个展开，R2.3）。
- [ ] **AC3** 标签胶囊可反复 toggle；取消选中父级标签时，已选子级标签保持选中（R3.3）。
- [ ] **AC4** 计时进行中，分类与标签胶囊均可点击修改，修改后刷新页面值仍生效
      （已落库）；页面不再出现不可点的只读标签徽章行（D6、R4.5、R5.2）。
- [ ] **AC5** 编辑一个指向已归档分类的旧条目：父级行末尾出现一枚带 `Archive` 图标的
      选中态胶囊（文案 = 后端 `categoryName`），且点它无反应；改选任一活动分类后
      该只读胶囊消失，保存成功无 409（D7、R6.2、R6.3）。
- [ ] **AC6** 无间隙换段后：桌面端分类胶囊行出现有限时长的脉冲高亮并自行停止；
      移动端 sheet 仍自动弹出（行为与 09-08 一致）；选完分类后动画终止（D8、R7.3）。

### 布局与兼容

- [ ] **AC7** 桌面 header 为双行；分类或标签多到折行时 header 高度随之增长，
      Timeline 不被截断且不出现页面级滚动条（R4.3、R4.4）。
- [ ] **AC8** 非 timer 页（统计 / 目标 / 分类 / 标签 / 设置）的单行大标题 header
      渲染与改动前一致（R4.3）。
- [ ] **AC9** 移动端底部停靠胶囊条形态不变；展开 sheet 后胶囊可见且可点，
      命中区在触屏下 ≥40px（R5.3、R5.5、R1.5）。
- [ ] **AC10** 两主题（light / dark）下胶囊选中 / 未选中 / 只读三态均可辨，
      颜色均来自 `paletteColor` / `color-mix` 派生，无硬编码色值（R1.3、R7.2）。

### 代码与质量门禁

- [ ] **AC11** `CategoryPicker.tsx` / `TagPicker.tsx` 中不再出现任何 `DropdownMenu`
      相关 import 与 JSX（D4）；`runningTags` / `runningTagColors` / `timer.selectTags` /
      `timer.tagSeparator` 在全仓无残留引用（D6、R3.6）。
- [ ] **AC12** 无后端改动：`server/` 下无文件变更（D5）。
- [ ] **AC13** `npm run typecheck` 与 `npm test` 全部通过；zh / en 两份 i18n
      key 集合保持一致（`en` 类型为 `Record<keyof typeof zh, string>`）。
- [ ] **AC14** 新增 / 重写的测试覆盖 R8.1–R8.5 所列场景。

## Out of Scope

- 后端改动（D5 已确定不需要：不新增 `lastUsedAt`、不改排序、不改 API 形状）
- 分类 / 标签管理页（`CategoriesPage` / `TagsPage`）的列表样式
- `GoalEditorDialog` 里的分类 / 标签下拉（另一套 DropdownMenu，非本任务范围）

## Open Questions（阻塞）

无。所有用户归属的产品 / 范围 / UX / 风险决策已解决（D1–D8）。
