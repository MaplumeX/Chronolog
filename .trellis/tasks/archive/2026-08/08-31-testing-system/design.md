# 技术设计：测试体系（web 基建 + server 补强）

## 总体架构

两端采用**各自原生、互不耦合**的测试栈，通过根 `package.json` 的 `test` 脚本串联，CI 无需结构性改动。

```
根 npm test
├── server: tsx --test test/*.test.ts        （node:test，既有）
│   └── test:coverage: + --experimental-test-coverage
└── web: vitest run                          （新增）
    └── test:coverage: vitest run --coverage (@vitest/coverage-v8)
```

## R1–R3 Web 测试栈设计

### 选型

| 决策 | 选择 | 理由 |
|---|---|---|
| 运行器 | **Vitest 3.x** | 与 Vite 8 原生集成，直接复用 `web/vite.config.ts` 的 react 插件与 `@` 别名；ESM 原生；快 |
| DOM 环境 | **jsdom** | hooks + radix 组件渲染需要 DOM；纯逻辑测试用 node 环境（Vitest 按文件 `// @vitest-environment` 或默认 jsdom 统一） |
| React 测试 | **@testing-library/react 16** + **@testing-library/jest-dom** + **@testing-library/user-event** | React 19 兼容；`renderHook` 测 hooks |
| 覆盖率 | **@vitest/coverage-v8** | Vitest 官方，V8 原生 |
| 组件冒烟 | jsdom 渲染 radix `DropdownMenu` | 验证链路；不做快照 |

### 配置

- `web/vitest.config.ts`：`defineConfig({ plugins:[react()], resolve.alias @ → ./src, test:{ environment:"jsdom", setupFiles:["./src/test/setup.ts"], globals:false, coverage:{ provider:"v8", include:["src/**"], exclude:["src/main.tsx","src/i18n/locales/**","src/components/ui/**"] } } })`
  - 也可用 `/// <reference types="vitest" />` 直接在 vite.config.ts 加 `test` 字段；独立 `vitest.config.ts` 更清晰。
- `web/src/test/setup.ts`：导入 `@testing-library/jest-dom`；初始化 i18n 为确定性 `en`；每个测试后清理 localStorage 与 fetch mock。
- 组件冒烟仅测 `CategoryPicker`（依赖少：radix DropdownMenu + paletteColor + sortHierarchical）。radix portal 渲染到 `document.body`，用 `userEvent.click(trigger)` 展开后查 `screen` 即可；若 portal 事件在 jsdom 成本过高，降级测 `DateNav`。

### 可测性分析（已验证源码）

- `format.ts`：纯函数，但 `formatClock`/`formatDayLabel` 依赖 `i18n.language` 与 `new Date()`。测试中固定 i18n 语言 + 传入固定 ISO/tz，或对 `new Date()` 用 `vi.useFakeTimers().setSystemTime()`。
- `hierarchy.ts`：纯函数，直接测。
- `api.ts`：`request()` 调 `globalThis.fetch`。用 `vi.stubGlobal("fetch", vi.fn())` 返回 `new Response(JSON.stringify(...), {status})`；验证 `ApiError.status/code`、`onUnauthorized` 触发/抑制、Content-Type 注入。`new Response` 在 jsdom/node22 均可用。
- `use-timer-controller.tsx`：`renderHook` + 包装 `I18nextProvider`（或 setup 已全局初始化）。`loadDateView` 是模块内函数，通过 hook 初始状态间接测；localStorage 异常用 `vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw})`。
- `use-theme.ts`/`use-mobile.ts`/`lib/utils.ts`：纯或近纯，按价值测。

## R4 Server 补强设计

### 覆盖率

- 改用 Node 22 原生：`tsx --test --experimental-test-coverage --test-coverage-include='src/**' test/*.test.ts`。
- 不引入 c8（tsx 是 loader，c8 对 ts 源映射支持需额外配置；Node 原生 coverage 与 tsx 配合已由 Node 22 支持，零新依赖）。
- `test:coverage` 仅产出报告，不设阈值门槛（PRD 明确不追求百分比）。

### 全局错误处理测试（新增 `server/test/errors.test.ts`）

直接构造场景，不经业务路由：

1. **AppError → 对应状态码**：注册一个临时 route 抛 `new AppError(403,"FORBIDDEN","x")`，断言 403 + `{error:{code:"FORBIDDEN"}}` 结构。
2. **未知异常 → 500**：临时 route 抛 `new Error("boom")`，断言 500 + `{error:{code:"INTERNAL"}}`。
3. **zod 校验失败 → 400 VALIDATION**：用 `parseBody` 直接断言，或经一真实 route 提交非法 body 断言 400 + `code:"VALIDATION"`。
4. **404**：请求不存在的 `/api/*` → JSON `NOT_FOUND`；请求非 api 路径 → 文本 404。
5. **errors.ts 纯函数**：`parseBody` 成功/失败、`isUniqueViolation` 真/假。

这些场景当前**无任何直接测试**（已 grep 确认 app.ts 的 errorHandler/notFoundHandler 无覆盖）。

### 真实缺口补齐

以覆盖率报告为依据，补少量完全缺失的负面分支；不逐 route 重复已有 4xx 测试。

## R5 CI 串联

- 根 `package.json` `"test": "npm test -w server && npm test -w web"`。
- `ci.yml` 已跑 `npm test`，自动覆盖两端；**无需改 workflow**。
- 可选：根 `test:coverage` 串联两端覆盖率。

## 兼容性与回滚

- 纯新增（web 测试栈、server 一个测试文件、根脚本改动），不触碰任何产品代码逻辑。
- 回滚 = revert commit；无数据迁移、无运行时行为变化。
- 风险：Vitest/jsdom 版本与 Vite 8/React 19 兼容——锁定 Vitest 3.x + @testing-library/react 16.x（均声明支持）。

## 新增依赖

**web devDependencies**：`vitest`、`@vitest/coverage-v8`、`jsdom`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`。
**server**：无新依赖（用 Node 原生 coverage）。
