# 技术设计：计时界面时间线改造

## 范围

仅前端 `web/src/pages/TimerPage.tsx` 与 `web/src/styles.css`。无后端变更。

## 现状

- `TimerPage` 顶部 `timer-bar` 控制计时（开始/停止/分类/描述）。
- 下方 `day-card`：`day-head`（日期 + 总计）+ 逐行 `row`（描述 · pill分类 · 时间范围 · 时长）。
- 数据来自 `api.todayEntries(tz)` → `TodayEntries { dayStart, dayEnd, entries[] }`，`entries` 每项有 `startedAt`、`stoppedAt`（运行中为 null）、`categoryName`、`description`、`id`。
- 时间运算用 `format.ts` 的 `formatClock`、`formatDuration`、`categoryColor`、`clipSeconds`、`elapsedSeconds`。

## 目标布局

```
┌─ timer-bar (不变) ─────────────────────────────┐
│ 描述 输入框   分类选择   已用时   ▶/■           │
└────────────────────────────────────────────────┘
┌─ timeline-card (新，替换 day-card) ────────────┐
│ day-head: 今天 · X月X日 星期X        H:MM:SS   │
│ ┌──┬──────────────────────────────────────┐   │
│ │00:00 │                                   │   │  ← 纵向时间轴
│ │01:00 │                                   │   │
│ │  ...  │   ┌──────────┐                  │   │
│ │10:00 │   │ 描述      │ ← 色块(已完成)     │   │
│ │  ...  │   │分类 9:00-│                   │   │
│ │      │   │10:30 1:30 │                  │   │
│ │      │   └──────────┘                   │   │
│ │14:00 │   ┌──────────┐                  │   │
│ │      │   │正在计时   │ ← 运行中色块      │   │
│ │      │   └──────────┘                   │   │
│ │ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ← 现在指示线    │   │
│ │15:00 │                                   │   │
│ │  ...  │                                   │   │
│ │24:00 │                                   │   │
│ └──┴──────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

## 关键决策

### 1. 时间坐标计算

- 以 `dayStart`/`dayEnd`（ISO 字符串）锚定 0:00–24:00。
- 每条色块的 `top` 和 `height` 用百分比，相对全天总毫秒数：
  - `dayMs = Date.parse(dayEnd) - Date.parse(dayStart)`
  - `top% = (entryStart - dayStart) / dayMs * 100`
  - `height% = (entryEnd - entryStart) / dayMs * 100`
  - 运行中条目 `entryEnd = nowMs`（由 `props.nowMs` 驱动，每秒更新）。
- 色块最小高度：保证极短条目（如几十秒）仍可见，约 `2px`。

### 2. 块内信息显示策略

按色块高度分档渲染，避免极短块内容溢出：
- **高 (≥ ~60px)**：描述 + 分类名 + 起止时间 + 时长，多行。
- **中 (~30–60px)**：描述 + 时长，单行/两行。
- **矮 (< 30px)**：仅描述（截断），其余信息用 `title` 属性悬浮显示。
- 阈值用 CSS 媒体/容器查询或固定 px 估算（全天 24h 映射到容器高度，按容器实际像素换算分档更稳妥——首版用固定阈值估算即可）。

首版实现：用 JS 计算每条记录的像素高度，根据阈值决定渲染内容层级（`showFull`/`showCompact`/`showMini`）。

### 3. 当前时间指示线

- 一条绝对定位的横线，`top% = (nowMs - dayStart) / dayMs * 100`，限制在 0–100%。
- 左侧时间标签处用一个小圆点 + 当前时间文字标记。
- 随 `props.nowMs` 每秒更新。

### 4. 运行中条目视觉区分

- 同分类色填充，但叠加一个微弱的脉冲边框或半透明描边（CSS `@keyframes`），与已完成条目区分。
- 若运行中条目与当前时间指示线位置一致（高度正在增长到"现在"），视觉上指示线即为条目底边。

### 5. 滚动与高度

- 24h 全天垂直排布，容器需可滚动。首版固定容器高度（如 `60vh` 或视口高度），内部 `overflow-y: auto`。
- 小时刻度行用 CSS 绝对定位 + `top%` 生成（每小时一行），与色块共用同一坐标系。
- 初始滚动位置：滚动到"现在"附近，避免一打开在 0:00。

### 6. 空状态

- 当 `today.entries.length === 0` 时，时间轴仅显示刻度 + 居中空状态文案（"今天还没有记录"），保留 `day-head`。

## 数据流

无变化。`TimerPage` 继续用 `refresh()` 拉取 `api.todayEntries` + `api.current` + `api.categories`，`props.nowMs` 驱动运行条目和指示线刷新。时间线视图是纯渲染层重构。

## 受影响文件

| 文件 | 改动 |
|------|------|
| `web/src/pages/TimerPage.tsx` | 将 `day-card` section 替换为时间线渲染；新增时间坐标计算与色块分档逻辑 |
| `web/src/styles.css` | 新增 `.timeline-card`、`.timeline-ruler`、`.timeline-track`、`.timeline-block`、`.now-line` 等样式；移除/保留旧 `.day-card`/`.row` 相关（旧 `.row` 不再使用，`.day-head` 复用） |

## 兼容性与回滚

- 改动隔离在 `TimerPage` 渲染层，不影响 `timer-bar`、其他页面、API、后端。
- 回滚 = 还原 `TimerPage.tsx` 的 `day-card` section + `styles.css` 对应样式。

## 测试

- 现有后端测试不受影响。
- 前端无测试框架（`package.json` 仅有 `build` 脚本）；以 `npm run build` 通过 + 手动验证为准。
- 手动验证清单：
  1. 多条已完成记录色块位置/高度/颜色正确。
  2. 运行中条目实时增长且视觉区分。
  3. 当前时间指示线位置正确并移动。
  4. 极短条目可见、悬浮可查详情。
  5. 空状态展示。
  6. 滚动定位到"现在"附近。