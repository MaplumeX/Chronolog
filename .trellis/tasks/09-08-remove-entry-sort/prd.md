# 移除条目视图的正/倒序切换

## Goal

用户反馈不需要正/倒序功能。移除 EntryListView（条目视图）的排序切换，
列表固定按开始时间**正序**（从早到晚，柳比歇夫流水账式）。

## Background

- 任务 09-08-axis-view 交付的条目视图包含 R5 排序切换（正/倒序 + localStorage
  `chronolog-entry-view-sort` 记忆），用户使用后决定不需要。
- 正序即唯一行为后，滚动锚定逻辑简化：今天滚到底部（运行中在最后）、
  历史日期滚到顶部。

## Requirements

### R1 移除排序功能

- 移除排序切换按钮（ArrowDown/ArrowUp 图标按钮）及其 `touch-hit--x` 命中区。
- 移除 `chronolog-entry-view-sort` localStorage 读写（排序不再有状态，
  固定正序；残留的旧 key 值无副作用，不主动清理）。
- 列表渲染固定按开始时间正序。
- 滚动 effect 依赖数组去掉 sort 相关项（保留 day 切换重锚定）。

### R2 清理伴随产物

- 移除 i18n key `timeline.sortAsc` / `timeline.sortDesc`（zh + en 同步，
  en 是 Record<keyof typeof zh, string>，必须两侧一致）。
- 更新测试：EntryListView.test.tsx 删除排序切换/记忆测试点，
  改为断言正序渲染（首行最早条目）。
- 更新 spec：component-guidelines.md Timeline 段落中 sort 持久化描述、
  state-management.md 的 `chronolog-entry-view-sort` 记录。

## Out of Scope

- 不改动块视图、week 模式、gap 幽灵卡等其他条目视图功能。
- 不做旧 localStorage key 的迁移/清除逻辑。

## Acceptance Criteria

- [ ] AC1 条目视图无排序按钮，固定正序（首行 = 最早开始条目）。
- [ ] AC2 `chronolog-entry-view-sort` 不再被读写。
- [ ] AC3 `timeline.sortAsc` / `timeline.sortDesc` key 从 zh/en 移除，
      i18n 无悬空引用。
- [ ] AC4 测试更新后 `npm test -w web` 全绿，`npm run typecheck -w web` 通过。
- [ ] AC5 spec 描述同步（component-guidelines / state-management）。
