# 建立完善的测试体系（web 测试基建 + server 补强）

## Goal

为 Chronolog monorepo 建立可持续的测试体系：为目前零覆盖的 web 前端引入测试基建与高价值覆盖，同时为已有良好集成测试基础的 server 端补齐覆盖率可视化与全局错误路径缺口，并将两端统一接入 CI。

## Background / Confirmed Facts

仓库证据（已调研，无需用户确认）：

- **Server**：Fastify + better-sqlite3 + drizzle；14 个测试文件 / 5086 行，`server/test/helpers.ts` 提供完整基建（`createTestApp` 内存 inject + 临时 SQLite + 可注入时钟 `now` + `registerUser`/`cookieHeader`）。9 个 routes 全部有对应测试，错误路径（4xx）已大量覆盖（entries 39 处、categories 24、goals 24、tags 23 等）。`npm test` 经 `tsx --test test/*.test.ts` 运行。
- **Web**：React 19 + Vite + Tailwind + i18next + recharts；**零测试**（无框架、无脚本、无配置）。可测纯逻辑约 958 行：
  - `web/src/format.ts`（192 行：`formatDuration`/`formatClock`/`formatWeekLabel`/`browserTz`/`clipSeconds`/`elapsedSeconds` 等，含 DST 与 locale 逻辑）
  - `web/src/hierarchy.ts`（31 行：`sortHierarchical`/`topLevel`，含孤儿节点降级）
  - `web/src/api.ts`（315 行：`ApiError`/`setOnUnauthorized`/`request()` fetch 封装，mock `globalThis.fetch` 可测，无需渲染）
  - `web/src/hooks/use-timer-controller.tsx`（341 行：state + effects + `loadDateView` localStorage 降级，返回状态非 JSX，可用 `renderHook` 测）
  - `web/src/hooks/use-theme.ts`、`use-mobile.ts`、`lib/utils.ts`
- **CI**：`.github/workflows/ci.yml` 已跑 `npm run typecheck` + `npm test`（Node 22，npm workspaces）。
- **Vite 配置**：`web/vite.config.ts` 使用 `@vitejs/plugin-react` + `@tailwindcss/vite`，别名 `@ → ./src` Vitest 可直接复用。

## Requirements

### R1 — Web 测试基建

- 引入 Vitest（与 Vite 8 兼容）+ `@testing-library/react` + `@testing-library/jest-dom` + jsdom 作为 web 测试栈。
- `web` 包新增 `test` 与 `test:coverage` 脚本；测试文件遵循 `*.test.ts(x)` 约定，就近放置（`web/src/**`）。
- 复用 `web/vite.config.ts`（插件、别名），通过 `vitest` 环境配置切换 jsdom；i18n 在测试中可初始化为确定性语言。
- 提供共享测试工具（如 fetch mock helper、i18n 初始化、localStorage 清理）。

### R2 — Web 纯逻辑与 hooks 覆盖（深度 A）

- `format.ts`：时长格式化、时钟/周标签的时区与 locale 行为、DST 边界、`clipSeconds`/`elapsedSeconds`。
- `hierarchy.ts`：两级排序、孤儿节点降级、空列表/全顶层/全子级边界。
- `api.ts`：`request()` 的成功/HTTP 错误/网络错误路径、`ApiError` 字段、401 触发 `onUnauthorized`（含 `authFail:false` 抑制）、Content-Type 注入。
- `use-timer-controller.tsx`：`loadDateView` 的合法值/垃圾值/localStorage 异常降级；其余 hook 行为按价值取舍。
- `use-theme.ts` / `use-mobile.ts` / `lib/utils.ts`：按价值取舍。

### R3 — Web 组件冒烟（深度 A，1–2 个代表性组件）

- `CategoryPicker`：渲染所选分类、颜色回退（`paletteColor`）、层级排序展示、onChange 回调。验证 jsdom + radix 渲染链路可用。
- 不做全量组件快照；不测 recharts 图表内部渲染。

### R4 — Server 补强（不重写已有测试）

- 接入覆盖率工具（`node:test` 内置 coverage 或 c8），输出文本 + 摘要，纳入 `npm run test:coverage`（server）。
- 全局错误处理直接测试：`server/src/errors.ts` 与 `app.ts` 的错误形态（zod 校验失败 400 结构、未捕获异常 500 结构、404），不经具体业务路由。
- 梳理后补少量真实缺口（如某 route 完全缺失的负面分支），以覆盖率报告为依据，不追求百分比数字目标。

### R5 — CI 串联

- 根 `package.json` 的 `test` 脚本同时运行 server 与 web 测试。
- CI（`.github/workflows/ci.yml`）无需结构性改动即可覆盖两端（`npm test` 自动包含 web）。

## Acceptance Criteria

- [ ] `cd web && npm test` 通过，覆盖 R2 所列模块与 R3 组件，且全部确定性（无真实网络/真实计时器依赖）。
- [ ] `cd web && npm run test:coverage` 产出覆盖率报告。
- [ ] `cd server && npm run test:coverage` 产出覆盖率报告。
- [ ] server 新增全局错误处理测试文件通过，且不与现有路由测试重复。
- [ ] 根目录 `npm test` 同时运行并通过 server + web 全部测试。
- [ ] `npm run typecheck` 通过（新增测试代码纳入类型检查）。
- [ ] CI workflow 在 PR 上对两端测试全绿（无需改 workflow 结构，或仅最小改动）。

## Out of Scope

- E2E 测试（Playwright/Cypress）——建议作为独立后续任务。
- 全量 React 组件渲染测试 / 视觉快照。
- recharts 图表内部行为测试。
- server 路由层的重复负面测试重写或追求覆盖率百分比阈值。
- 性能/负载测试。

## Key Decisions

- **Web 深度选 A**：纯逻辑 + hooks 全覆盖 + 1–2 个代表性组件冒烟；组件层不做全量（jsdom 下 recharts/radix 渲染成本高且脆弱），回归风险最高的纯逻辑与 hooks 性价比最高。
- **Server 不重写**：现有 5086 行集成测试质量良好，补强聚焦覆盖率可视化 + 全局错误路径，避免重复。
- **测试栈选 Vitest 而非 Jest**：与 Vite 8 原生集成、复用 vite.config、ESM 友好、速度快。

## Risks / Deferred

- jsdom 下 radix-ui `DropdownMenu` 的 portal/指针事件可能需要 `user-event` 或手动 fireEvent——在 R3 实施时验证，若成本过高降级为更简单的组件（如 `DateNav`）。
- i18next 在测试环境的初始化语言确定性——通过测试 setup 固定为 `en` 或 mock。
- 覆盖率工具选型（`node:test --experimental-test-coverage` vs c8）在 design 中定夺。
