# Implement — Chip-based category and tag pickers

## 执行顺序

自底向上：基元 → 领域层 → 装配层 → 清理 → 测试。
每步结束跑 `npm run typecheck -w web`；步骤 8 后跑完整 `npm test`。

---

### Step 1 — CSS 基础（`web/src/styles.css`）

- [ ] 新增 `.chip` 基础样式（`rounded-full`、边框、padding、transition）
- [ ] 新增 `.chip--solid[aria-pressed="true"]` / `.chip--outline[aria-pressed="true"]`
      选中态（消费 `--chip-color` / `--chip-foreground`，见 design §4）
- [ ] 新增 `.chip--readonly`（muted 前景，无 `--chip-color`）
- [ ] 新增 `@keyframes chip-hint-pulse` + `.chip-group--hinted`
      （`iteration-count: 2`，**不得 infinite**，见 design §6.3）
- [ ] `@media (hover: none)` 内新增 `.chip` 垂直 padding 增大规则
      （**不要用 `.touch-hit`**，见 design §3）

验证：`npm run build -w web` 通过，无 CSS 语法错误。

---

### Step 2 — 新建 `web/src/components/ChipGroup.tsx`

- [ ] 按 design §2 的 props 契约实现
- [ ] 纯展示：不 import `api`、不含 `t()`
- [ ] 颜色经 `paletteColor` / `paletteForegroundColor` 注入 CSS 变量（inline style）
- [ ] `aria-pressed` / `aria-disabled` / `disabled` 按 R1.6
- [ ] 容器 `flex flex-wrap gap-1.5`；`hinted` 时加 `.chip-group--hinted`

---

### Step 3 — 重写 `CategoryPicker.tsx`（单选）

- [ ] 删除全部 `DropdownMenu` import 与 JSX
- [ ] props 变更：删 `open` / `onOpenChange` / `label` / `colorName`；
      加 `readonlyName?: string | null`、`hinted?: boolean`
- [ ] `expandedParentId` 内部 state + 「value 指向子级时父级默认展开」派生初值（R2.3）
- [ ] `onSelect` = 替换语义；点父级同时选中 + 展开（R2.2）
- [ ] `readonlyName` 非空时在末尾渲染只读胶囊（D7）

---

### Step 4 — 重写 `TagPicker.tsx`（多选）

- [ ] 同 Step 3 的结构改造
- [ ] props 变更：删 `label`
- [ ] `onSelect` = toggle 语义；取消父级不连带子级（R3.3）
- [ ] 已选子级 → 父级默认展开（R3.4）
- [ ] 空列表保留 `t("tags.empty")`

---

### Step 5 — `TimerBar.tsx` 双行改造

- [ ] 按 design §5.2 拆成两行
- [ ] 删除运行中只读徽章行分支 + `runningTags` / `runningTagColors` props（R4.5）
- [ ] 删除 `md:flex-row` 等移动端 dead markup
- [ ] 两组之间加 hairline 分隔（`h-5 w-px bg-border`）

---

### Step 6 — `Shell.tsx` + `App.tsx` header 适配

- [ ] `Shell.tsx:226` header 改 `items-start`，`SidebarTrigger` 包 `min-h-12 items-center`
      容器（design §5.1）
- [ ] `App.tsx` 非 timer 页的 `<h1>` 加 `flex min-h-12 items-center` 保证垂直居中（AC8）
- [ ] 实测：切到统计/目标/分类/标签/设置页，标题位置与改动前一致

---

### Step 7 — `use-timer-controller.tsx` 信号与装配

- [ ] `categoryPickerAutoOpen` → `categoryHintActive`（4 处，design §6.1）
- [ ] 删除 `:332` 的受控 `open` / `onOpenChange`，改传 `hinted`
- [ ] 保留 `:363` 的 `barProps.autoOpenEditor`（移动 sheet 仍需）
- [ ] 删除 `tagPickerLabel` / `pickerLabel` / `pickerColor` 拼接逻辑
- [ ] 删除 `barProps.runningTags` / `runningTagColors`

---

### Step 8 — `MobileTimerDock.tsx` + `EntryEditor.tsx`

- [ ] Dock：删只读徽章行分支（`:126-149`）及两个 props（R5.2）
- [ ] Dock：确认 `open = manualOpen || autoOpenEditor` 纯派生**未被改动**（R5.4）
- [ ] Editor：传 `readonlyName`（`categoryId` 不命中 `filterActive` 时给
      `props.entry.categoryName`，R6.2）
- [ ] Editor：删 `tagPickerLabel` / `categoryLabel` 触发器专用逻辑
- [ ] Editor：确认 `disabled={categoryId === ""}` 保存守卫仍在（R6.3）

---

### Step 9 — i18n 清理

- [ ] `zh.ts` / `en.ts` 同步删除 `timer.selectTags`、`timer.tagSeparator`
- [ ] 保留 `timer.selectCategory`（Label 文案仍用）
- [ ] `npm run typecheck -w web` —— `en` 的 `Record<keyof typeof zh, string>`
      类型会自动校验两侧一致（AC13）

---

### Step 10 — 测试

- [ ] 重写 `CategoryPicker.test.tsx`：删 radix portal 清理 / `menuitem` 断言 /
      `PointerEventsCheckLevel.Never`；改为胶囊按钮断言 + 新增 R2.2/R2.3/R2.5/R1.3 用例
- [ ] 新建 `TagPicker.test.tsx`：toggle、R3.3、R3.4
- [ ] 新建 `ChipGroup.test.tsx`：smoke（渲染、选中态、disabled）
- [ ] `MobileTimerDock.test.tsx`：删 `runningTags` 夹具与 `:126` 用例，保留 sheet 派生用例
- [ ] `EntryEditor.test.tsx`：下拉交互用例改胶囊点击
- [ ] `npm test -w web` 全绿

---

## 验证命令

```bash
npm run typecheck            # 根级，含 server + web
npm test -w web
npm run build -w web
```

## 残留引用自检（AC11 / AC12）

```bash
# 应全部无输出
grep -rn "DropdownMenu" web/src/components/CategoryPicker.tsx web/src/components/TagPicker.tsx
grep -rn "runningTags\|runningTagColors" web/src --include=*.tsx
grep -rn "timer.selectTags\|timer.tagSeparator" web/src
# 应无变更
git status --porcelain server/
```

## 手工验收（jsdom 覆盖不到，必须真实浏览器）

按 `quality-guidelines.md` 的「Manual checks when UI changes」执行，重点：

1. 桌面：开始计时 → 计时中点分类胶囊、点标签胶囊 → 刷新页面确认已落库（AC4）
2. 桌面：分类建到 8+ 个使其折行 → 确认 Timeline 不被截断、无页面级滚动条（AC7）
3. 桌面：非 timer 页标题垂直位置正常（AC8）
4. 归档一个分类 → 编辑指向它的旧条目 → 只读胶囊出现、不可点、改选后消失（AC5）
5. 无间隙换段 → 桌面脉冲高亮出现且自停；移动 sheet 自动弹出（AC6）
6. 移动端（<768px）：sheet 内胶囊可点、命中区足够（AC9）
7. light / dark 两主题切换确认三态可辨（AC10）
8. **modal-in-modal**：移动 sheet 内的 `ConfirmDialog` / `MergeDialog` 仍能打开
   （现有已知风险点，jsdom 测不出）

## 风险点与回滚

| 风险 | 缓解 |
|------|------|
| `items-start` 改动影响所有页面 header | Step 6 单独验证 AC8；出问题只回退 Shell/App 两文件 |
| 胶囊 gap 与触屏命中区冲突 | design §3 已定不用 `.touch-hit`；实机验证 AC9 |
| 移动 sheet 派生开启链路被误改 | Step 8 显式检查项；`MobileTimerDock.test.tsx` 保留该用例 |
| 脉冲动画不停 | Step 1 检查 `iteration-count: 2`，禁止 `infinite` |

回滚：单 commit，`git revert` 完全回退（design §7.3）。
