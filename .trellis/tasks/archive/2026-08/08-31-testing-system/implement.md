# 执行计划：测试体系

## 有序检查清单

### 阶段 1 — Web 测试基建（R1）

- [ ] 1.1 安装 web devDependencies：`vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- [ ] 1.2 新建 `web/vitest.config.ts`（react 插件 + `@` 别名 + jsdom + setup + coverage v8 include/exclude）
- [ ] 1.3 新建 `web/src/test/setup.ts`（jest-dom 匹配器、i18n 固定语言、afterEach 清理 localStorage/unstubAllGlobals）
- [ ] 1.4 `web/package.json` 加 `test: "vitest run"`、`test:coverage: "vitest run --coverage"`、`test:watch: "vitest"`
- [ ] 1.5 验证：`cd web && npm test`（空套件通过/无测试也退出码正确）

### 阶段 2 — Web 纯逻辑测试（R2）

- [ ] 2.1 `web/src/hierarchy.test.ts`：sortHierarchical 排序/孤儿降级/边界；topLevel
- [ ] 2.2 `web/src/format.test.ts`：formatDuration、formatClock/formatWeekLabel（fake timers 固定系统时间）、clipSeconds/elapsedSeconds、paletteColor
- [ ] 2.3 `web/src/api.test.ts`：request 成功/HTTP 错误/网络错误、ApiError 字段、onUnauthorized 触发与 authFail:false 抑制、Content-Type 注入（vi.stubGlobal fetch）
- [ ] 2.4 `web/src/lib/utils.test.ts`（cn）与 `web/src/hooks/use-theme.test.ts`、`use-mobile.test.ts`（按价值）
- [ ] 2.5 验证：`cd web && npm test` 全绿

### 阶段 3 — Web hooks 与组件冒烟（R2 收尾 + R3）

- [ ] 3.1 `web/src/hooks/use-timer-controller.test.tsx`：renderHook 测 loadDateView 合法/垃圾/localStorage 异常降级；props.enabled 门控
- [ ] 3.2 `web/src/components/CategoryPicker.test.tsx`：渲染选中项、paletteColor 回退、层级排序、userEvent 展开 DropdownMenu 触发 onChange
- [ ] 3.3 验证：`cd web && npm test && npm run test:coverage` 全绿且出报告

### 阶段 4 — Server 补强（R4）

- [ ] 4.1 `server/package.json` 加 `test:coverage: "tsx --test --experimental-test-coverage --test-coverage-include='src/**' test/*.test.ts"`
- [ ] 4.2 新建 `server/test/errors.test.ts`：AppError→状态码、未知→500、parseBody/zod→400 VALIDATION、/api 404 JSON、非 api 404 文本、isUniqueViolation
- [ ] 4.3 跑 `npm run test:coverage -w server`，据报告补真实缺口（若有）
- [ ] 4.4 验证：`cd server && npm test && npm run test:coverage` 全绿

### 阶段 5 — CI 串联 + 全量验证（R5）

- [ ] 5.1 根 `package.json` `"test": "npm test -w server && npm test -w web"`；加根 `test:coverage`
- [ ] 5.2 全量验证（见下）
- [ ] 5.3 确认 ci.yml 无需改动（npm test 已覆盖两端）

## 验证命令

```bash
npm run typecheck                      # 两端类型检查（含新测试文件）
npm test                               # 根：server + web 全量
npm run test:coverage                  # 两端覆盖率报告
cd web && npm test && npm run test:coverage
cd server && npm test && npm run test:coverage
```

## 风险文件 / 回滚点

| 项 | 风险 | 回滚 |
|---|---|---|
| `web/vitest.config.ts` | 与 vite.config 插件冲突（重复 react 插件） | 独立配置文件，互不干扰；删文件即回滚 |
| `CategoryPicker.test.tsx` | radix portal/指针事件在 jsdom 脆弱 | 降级为 `DateNav` 冒烟 |
| `use-timer-controller.test.tsx` | fake timers 与 debounce ref 交互 | 只测 loadDateView 降级路径 |
| `server/test/errors.test.ts` | 临时 route 注册需 app 实例——复用 `helpers.ts` 的 `createTestApp` 后用 `app.register` 挂测试路由 | 删文件即回滚 |
| 根 `package.json` test 脚本 | 一端失败阻塞另一端输出 | 脚本独立，单独调试 |

全程不修改产品代码逻辑；每个阶段独立可提交。

## 评审关口

- 阶段 1 完成后确认基建可跑（`cd web && npm test` 退出码 0）再进入写测试。
- 阶段 5 全量验证通过后方可进入 Phase 3（spec update + commit）。
