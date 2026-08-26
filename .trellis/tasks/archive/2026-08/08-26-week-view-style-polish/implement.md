# Implement: 周视图样式优化

## 步骤

1. `web/src/format.ts`：新增 `formatWeekdayHeader(iso, tz)`，返回 `{ day, weekday }`。
2. `web/src/components/Timeline.tsx`：
   - `DayColumn` 增加 `showRuler?: boolean`（默认 true）；false 时跳过 ruler，track 加 `timeline-track--full` class。
   - week 模式：外层 flex 容器首项渲染共享 ruler（`<div className="timeline-ruler">` 复用），7 列 `showRuler={false}`。
   - 列头改为日期数字（大、粗）+ 星期；当天加高亮 class。
   - week 模式不传 `emptyHint`。
3. `web/src/styles.css`：新增 `.timeline-track--full { left: 0 }`；列头高亮样式（可用 Tailwind class 内联，无需 CSS）。
4. 验证：`cd web && npm run build`（TypeScript + 构建通过）。

## 验证命令

```bash
cd web && npm run build
```

## 回滚点

- 单次 commit 内完成，回滚 = revert 该 commit。
- 改动文件：`web/src/format.ts`、`web/src/components/Timeline.tsx`、`web/src/styles.css`。
