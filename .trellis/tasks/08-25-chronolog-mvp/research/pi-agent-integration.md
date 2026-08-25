# Research: earendil-works/pi 对 Chronolog 技术栈的影响

- Query: 若日后接入 https://github.com/earendil-works/pi 的 agent 相关包，Chronolog 应用什么技术栈。
- Date: 2026-08-25
- Scope: 技术约束；**不进入本 MVP**。

## Recommendation

Chronolog 第一版用 **Node.js 22 + TypeScript 全栈**（Hono + Vite React + SQLite）。这与 pi 同生态。Agent 功能本身留到后续任务，本 MVP 只把 Node 22 / ESM 当作兼容约束。

不要为了「以后可能接 agent」去选 Python 或 Go 当应用主语言。

## What pi actually is

Pi 是 TypeScript monorepo，发布为 npm ESM 包，不是 Python/Go 库。

| 包 | 用途 | 接入方式 |
|---|---|---|
| `@earendil-works/pi-ai` | 统一多模型 LLM API | `import`（Node） |
| `@earendil-works/pi-agent-core` | Agent 循环、工具、状态 | `import`（Node）；`engines.node >= 22.19.0` |
| `@earendil-works/pi-coding-agent` | 含 SDK：`createAgentSession()` 嵌进 Node 应用 | `import`；也可用 CLI `pi --mode rpc` |
| Extensions / skills | TypeScript 模块 | 同进程加载 |

官方 SDK 文档明确：**嵌进应用、自定义 UI、自动化流水线用 Node SDK**；**另一种语言才用 RPC 子进程**。

来源：

- https://github.com/earendil-works/pi
- https://pi.dev/docs/latest/sdk
- https://github.com/earendil-works/pi/blob/main/packages/agent/package.json

## How this maps to Chronolog later

合理形态（后续任务，非本 MVP）：

1. 同一 Node 进程里 `import { Agent } from "@earendil-works/pi-agent-core"`（或 `createAgentSession`）。
2. 用 TypeScript `defineTool` 包一层 Chronolog 能力（开始/停止计时、列分类、今日合计）。
3. 浏览器走现有 HTTP/SSE；agent 不跑在前端。

若应用主后端是 Python/Go：只能 `pi --mode rpc` 再起一个 Node 子进程。Docker 变成双运行时，工具要跨进程调 HTTP，类型不能共用。能做，但比同进程 SDK 差一截。

## Stack implication for this MVP

| 选择 | 以后接 pi |
|---|---|
| TS + Node 22 + Hono + React + SQLite | 直接 `import` 包；工具与 API 同语言 |
| Python FastAPI + React | 只能 RPC 子进程或另写 Node sidecar |
| Go + React | 同上 |

第一版**不要**引入 pi 依赖、不要做对话 UI。只要求：Node 22、`"type": "module"`，避免选会挡住日后 `import` 的运行时。

## Caveats

- 用户还没说 agent 做什么（分类建议、日报、自动开始计时等）。本文件只约束语言生态。
- `@earendil-works/pi-agent-core` 要求 Node `>=22.19.0`。镜像应钉 Node 22 LTS，不要用 20。
- pi 默认没有权限沙箱；若以后让 agent 跑 shell，要另做隔离。计时 CRUD 工具不需要 shell。
