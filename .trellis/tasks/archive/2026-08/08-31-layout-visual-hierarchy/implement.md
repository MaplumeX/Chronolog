# 执行计划：重构整体布局结构与视觉层级

## 前置条件

- [x] `prd.md` / `design.md` 就绪
- [ ] 用户批准规划摘要（Phase 1.4 review gate）
- [ ] `task.py start` 后方可动工

## 实现顺序（自底向上：token → 原语 → 骨架 → 页面）

### Step 1 · Token 层（styles.css）
- [ ] 1.1 调整 light：`--background` 降明度、`--card`/`--popover` 升至近白；dark：`--card`/`--popover` 升一档；核对 `--sidebar` 与 background 关系
- [ ] 1.2 新增 `--shadow-xs`（light/dark 各一套），`@theme inline` 映射为 `shadow-xs` 工具类
- [ ] 1.3 验证：typecheck + 双主题目测；语义 token 配对 AA 对比度（参考 08-29 任务 research 的 contrast-check.mjs，若不在仓库则手写快速核对）
- 回滚点：git diff 仅 styles.css，随时可整段还原

### Step 2 · 共享原语
- [ ] 2.1 新建 `web/src/components/ui/card.tsx`（六件套，`cn()` + `data-slot`，与现有 ui/* 同构）
- [ ] 2.2 新建 `web/src/components/PageContainer.tsx`（size: default/wide/full；`p-4 md:p-6`）
- [ ] 2.3 验证：typecheck

### Step 3 · Shell 骨架
- [ ] 3.1 顶栏：`h1` 标题层级提升（`text-xl font-semibold tracking-tight`）；评估 `min-h-12`→`h-14`（与 TimerBar 高度兼容后定）
- [ ] 3.2 侧栏精修：品牌区/nav/footer 间距与 active 态微调
- [ ] 3.3 验证：typecheck + 桌面/移动侧栏行为冒烟（collapse、drawer）

### Step 4 · 页面改造（每页独立可验证；顺序按风险从低到高）
- [ ] 4.1 CategoriesPage + TagsPage：PageContainer(wide) + 工具栏行 + Table 入 Card（`CardContent p-0` + `overflow-hidden` 圆角处理）
- [ ] 4.2 GoalsPage：同上 + 新建按钮 `ml-auto`
- [ ] 4.3 StatsPage：PageContainer(wide) + 工具栏行 + 四张模块 Card（总时长/趋势/分类/标签）
- [ ] 4.4 SettingsPage（含 TokensPage 嵌入区）：PageContainer(default) + 分组 Card（通用/资料/密码/危险区/Tokens）
- [ ] 4.5 AuthPage：表单容器套 Card
- [ ] 4.6 计时页：TimerBar 间距精修；Timeline 工具栏行精修（本体零改动）；容器 full
- [ ] 4.7 每步验证：typecheck；全部完成后 `npm run build`

### Step 5 · 全量回归
- [ ] 5.1 硬编码颜色 grep（design §10 命令）无新增例外
- [ ] 5.2 双主题 × 6 页面 × 桌面/移动人工核对（AC5）
- [ ] 5.3 功能冒烟：计时启动/停止/编辑、拖拽创建、gap 点击、统计 range 切换+tag 筛选+rollup、目标 CRUD、分类/标签层级操作、设置保存（AC6）

### Step 6 · Spec 同步（Phase 3.3，实现完成后）
- [ ] 6.1 修订 `component-guidelines.md`：删除/改写 no-card 条款，落地「轻卡片」新规范（Card 用法、页面结构三段式、PageContainer 档位、表格入卡模式、Timeline 特例）
- [ ] 6.2 修订 `design-tokens.md`：表面层级（background vs card 明度差）、`--shadow-xs`、type scale 表、卡片 radius/内边距约定
- [ ] 6.3 更新 Shell/Pages 章节中过时的 class 描述（如 `text-lg font-semibold` 标题、StatsPage「plain rounded-lg border div」）

## 验证命令

```bash
cd web && npm run typecheck        # 每步后
cd web && npm run build            # Step 4 完成后
grep -rn "oklch\|#[0-9a-fA-F]\{3,\}\|rgba\?(" web/src --include="*.tsx" | grep -v "var(--"   # Step 5.1
```

## 风险文件

| 文件 | 风险 | 缓解 |
|------|------|------|
| `styles.css` | 双主题色值微调影响全局对比度 | 每主题改完立即目测；token 配对 AA 核对 |
| `Shell.tsx` | 顶栏高度变化影响 TimerBar 布局 | TimerBar 高度自适应，改后桌面+移动各看一遍 |
| `Timeline.tsx` | 工具栏改动波及拖拽/popover 定位 | 只动工具栏行的 class，不碰 track/block 几何 |
| `StatsPage.tsx` | 卡片重排改动面最大 | 最后做；保持 JSX 块级移动、不改数据逻辑 |

## Review Gates

- Step 3 完成后：骨架（侧栏+顶栏+容器）先在双主题下过目，再铺页面。
- Step 4 每页完成后 typecheck 必须绿，不允许带病进入下一页。
