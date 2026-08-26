# 执行计划：计时界面时间线改造

## 执行顺序

### Step 1: 新增时间线样式 (`web/src/styles.css`)

在 `styles.css` 中新增时间线相关样式，保留 `.day-head` 复用，移除对旧 `.row` 的依赖（不删除已有规则，仅新增）：

- `.timeline-card`：卡片容器，替代 `.day-card` 的外壳。
- `.timeline-scroll`：可滚动容器，固定高度（`60vh`），`overflow-y: auto`。
- `.timeline-inner`：内部撑满 24h 的定位上下文，`position: relative`，高度由 JS 或 CSS 固定。
- `.timeline-ruler`：左侧时间刻度列，每小时一行（用 `top%` 定位的绝对元素或 CSS 重复线性渐变背景 + 文字标签）。
- `.timeline-track`：色块叠放区，`position: relative`，与刻度共享坐标系。
- `.timeline-block`：单条记录色块，绝对定位，背景取分类色，圆角，内边距，溢出省略。
- `.timeline-block.running`：运行中条目的脉冲/描边变体。
- `.block-desc`/`.block-meta`/`.block-time`/`.block-dur`：块内分档文字。
- `.now-line`：当前时间指示线，绝对定位横线 + 左侧标签。

### Step 2: 时间坐标与渲染逻辑 (`web/src/pages/TimerPage.tsx`)

1. 计算 `dayMs = parse(dayEnd) - parse(dayStart)`。
2. 辅助函数 `posPercent(isoOrMs)` → `(t - dayStart) / dayMs * 100`，clamp 0–100。
3. 小时刻度数组：`Array.from({length:25}, (_,i) => i)` 渲染 0:00…24:00 标签，每个 `top% = i/24*100`。
4. 色块渲染：遍历 `today.entries`，计算 `top%`、`height%`：
   - `entryEnd = e.stoppedAt ? parse(stoppedAt) : props.nowMs`
   - `height%` 基于 `entryEnd - parse(startedAt)`，最小高度兜底（用 `min-height` px）。
   - 像素高度估算：`trackHeightPx * height% / 100`，用于分档（用 `useRef` 测量容器实际高度，`ResizeObserver` 或首渲染后 `clientHeight`）。首版可用固定阈值基于全天映射比例换算（如全天容器 ~480px，则每小时 20px，30px 约对应 1.5h——但条目时长未知，故直接用 height% 换算到 px 需容器高度）。**简化首版**：不测量容器，按 `height%` 阈值分档（≥2.5% → full，1–2.5% → compact，<1% → mini），全天 24h 即 100%，2.5% ≈ 36min。此法与容器无关、稳定。
5. 块内内容按分档渲染：
   - `full`（≥2.5%）：描述（粗体）+ 分类名 + `formatClock` 起止 + `formatDuration`。
   - `compact`（1–2.5%）：描述 + 时长，单行截断。
   - `mini`（<1%）：仅描述截断，其余进 `title` 属性。
6. 运行中条目加 `running` className，CSS 脉冲描边。
7. 当前时间指示线：`nowTop% = posPercent(props.nowMs)`，渲染 `.now-line` + 左侧 `formatClock(now)` 标签。
8. 初始滚动：`useEffect` 在 `today` 加载后，将 `.timeline-scroll` 滚动到 `nowTop%` 附近（减去半视口高度）。
9. 保留 `day-head`（日期 + `formatDuration(dayTotal)`）作为时间线卡片头部。

### Step 3: 构建验证

```bash
cd web && npm run build
```

确保无 TypeScript 错误、构建通过。

### Step 4: 手动验证清单

按 `design.md` 测试节逐项手动验证（需启动 dev server 或由用户验证）。

## 验证命令

- `cd web && npm run build` — 类型检查 + 构建
- `npm test`（仓库根，后端测试，应不受影响仍通过）

## Review Gates

- 构建通过后方可提交。
- 色块定位/分档逻辑需对照 `design.md` 的坐标公式复核。

## 回滚点

- 提交前：`git checkout -- web/src/pages/TimerPage.tsx web/src/styles.css`
- 提交后：`git revert <commit>`