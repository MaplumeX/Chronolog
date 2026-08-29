# Implement — Beautify time picker in entry editor

## 执行清单（有序）

1. [ ] i18n：在 `web/src/i18n/locales/zh.ts` / `en.ts` 新增 `entry.now`（现在 / Now），键保持同步。
2. [ ] 新建 `web/src/components/DateTimePicker.tsx`：
   - `TimeField`（时/分/秒单段步进输入：数字键入、ArrowUp/Down ±1、Shift ±10、环绕 clamp、段间跳转）。
   - `DateTimePicker`（Popover + Calendar + 三段 TimeField + 「现在」快捷按钮）。
   - value 契约：`YYYY-MM-DDTHH:mm:ss` 本地时间字符串。
3. [ ] 替换 `EntryEditor.tsx` 中两个 `datetime-local` Input 为 `DateTimePicker`；Label 关联到触发按钮；删除不再需要的 Input 引入（若他处仍用则保留）。
4. [ ] 样式校验：触发器对齐 CategoryPicker（outline、rounded-lg、w-full justify-start）；弹层 Calendar + 时间段 `border-t` 分隔；mono + tabular-nums；light/dark 双主题检查。
5. [ ] 自查键盘流：Tab 聚焦触发器 → Enter 打开 → 方向键选日期 → Tab 进入时间段键入/步进 → Esc 关闭。

## 验证命令

```bash
npm run typecheck -w web
npm run build -w web
```

## 手动验收（UI 变更必做）

- 编辑已有条目、从时间轴拖拽创建草稿两种入口各走一遍：改日期、改时间、用「现在」按钮，确认 duration 实时更新、保存成功、OVERLAP 报错仍正常。
- light / dark 两个主题下查看弹层与触发器。
- 窄窗口（Dialog 内）无溢出。

## 风险与回滚

- 核心复杂度集中在 TimeField 键盘逻辑；如实现受阻可先降级为「无段间自动跳转、保留 clamp + 步进」的最小版本。
- 回滚：revert 该 commit 即可，无数据影响。

## Start 前检查

- [ ] prd.md 收敛（无未决问题）
- [ ] implement.jsonl / check.jsonl 已填真实条目
