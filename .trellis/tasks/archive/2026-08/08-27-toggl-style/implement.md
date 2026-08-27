# Implement: Toggl 2.0 layout/form restyle (palette unchanged)

## 前置

- [ ] 分支：当前 worktree 分支 `thankful-frog`；commit 用英文 conventional commits

## Checklist（按序执行）

1. [ ] 抽取 `web/src/hooks/use-timer-controller.ts`
   - 从 `web/src/pages/TimerPage.tsx` 迁移全部状态与动作（不改逻辑）
   - 入参：`nowMs, current, onCurrent`；出参：`barProps, timelineProps`
2. [ ] 删除 `web/src/pages/TimerPage.tsx`（内容已全部迁移）
3. [ ] 改造 `web/src/components/TimerBar.tsx`（形态：text-lg 输入框、rounded-lg picker、text-xl 计时、去外层 border-b）
4. [ ] 改造 `web/src/components/Shell.tsx`
   - 新增 `header?: ReactNode` prop；顶栏 `min-h-12`，渲染 `[SidebarTrigger][header]`
   - `ShellNav` 加 `SidebarGroupLabel`（i18n `nav.group`）
5. [ ] 改造 `web/src/App.tsx`
   - 非 Timer 页：`header = <h1 class="text-lg font-semibold">{t(nav.*)}</h1>`
   - Timer 页：调 `useTimerController`，`header = <TimerBar {...barProps}/>`，children 放 `<Timeline {...timelineProps}/>`
6. [ ] 改造 `web/src/pages/StatsPage.tsx`：删 h1；顶部加总时长摘要卡（`text-3xl font-bold` 数值 + label `stats.totalLogged`）
7. [ ] `web/src/pages/CategoriesPage.tsx` / `TagsPage.tsx`：删 h1
8. [ ] i18n：`zh.ts`/`en.ts` 加 `nav.group`、`stats.totalLogged`（检查 `en.ts` 对应路径）
9. [ ] 检查 `TimerPage` 的残留引用（`grep -r "TimerPage" web/src`），确认 App 更新后无死引用

## 验证命令

```bash
npm run typecheck -w web
npm run build -w web
npm run dev -w web   # 手动过一遍：计时开始/停止、day/week 切换、日期切换、条目编辑 popover、统计摘要卡、分类/标签页、移动端宽度
```

## 风险与回滚点

- 风险文件：`App.tsx`（组装）、`use-timer-controller.ts`（状态迁移易漏 error 分支）
- 回滚：单 commit revert
- 验收时重点：running 时侧边栏 badge 计时仍走 App 的 `nowMs` interval；刷新后 running 状态恢复（`api.current()`）不因状态提升而断

## 完成后

- [ ] 更新 `.trellis/spec/frontend/component-guidelines.md`（Shell header 契约、TimerPage→hook 结构变化）
- [ ] 更新 `.trellis/spec/frontend/hook-guidelines.md` 与 `state-management.md`（旧约定"不加业务 hook/TimerPage 持有状态"已被本任务取代）
- [ ] 更新 `.trellis/spec/frontend/directory-structure.md`（TimerPage 删除、use-timer-controller 新增）
- [ ] commit（英文 conventional）
- [ ] 跑 trellis-finish-work skill
