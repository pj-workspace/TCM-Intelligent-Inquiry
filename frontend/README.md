# TCM Intelligent Inquiry — 前端

本目录为 **中医智能问询** Web 客户端，基于 **Next.js 16**（App Router）、**React 19**、**Tailwind CSS 4**，通过 HTTP 与 **SSE** 对接同仓库 `backend/` 中的 FastAPI 服务。

---

## 功能概览

- **对话**：流式渲染助手回复（SSE），与会话列表联动。
- **鉴权**：注册 / 登录，JWT 存于本地（键名见 `lib/api.ts` 中 `TOKEN_KEY`）。
- **知识库 / MCP 等**：随产品迭代调用后端开放的管理与业务接口；字段与路由以运行中的 `GET {BASE}/openapi.json` 为准。

集成契约（事件类型、匿名会话、错误码等）见仓库根目录 **`doc/frontend-integration.md`**。

---

## 环境要求

- **Node.js**：建议使用当前 LTS（例如 20.x），与团队 CI 一致即可。
- **包管理**：任选 `npm` / `pnpm` / `yarn` / `bun`（下文以 `npm` 为例）。
- **后端**：本地需可访问 FastAPI（默认 `http://127.0.0.1:8000`），且后端 `CORS_ORIGINS` 包含前端源（如 `http://localhost:3000`）。

---

## 本地开发

```bash
cd frontend
npm install
# 可选：新建 .env.local，见下方「环境变量」
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

常用脚本：

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（热更新） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产构建产物 |
| `npm run lint` | ESLint |

---

## 环境变量（`.env.local`）

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_BASE_URL` | API 根 URL，**无尾部斜杠**。默认 `http://127.0.0.1:8000`。 |
| `NEXT_PUBLIC_API_KEY` | 与后端 `API_KEY` 一致；后端启用 API Key 时，浏览器请求需带 `X-API-Key`，由 `lib/api.ts` 注入。 |

修改以 `NEXT_PUBLIC_` 开头的变量后需**重启** `next dev`，以便重新注入到客户端包。

---

## 与后端协作要点

1. **CORS**：`backend/.env` 中 `CORS_ORIGINS` 需包含前端地址。
2. **OpenAPI**：实现新接口时优先对照 `/docs` 或 `openapi.json`，避免与 `doc/` 中说明脱节时误以文档为准（以 OpenAPI 为字段级真相）。
3. **SSE**：流式协议细节见 `doc/frontend-integration.md`；后端若新增事件 `type`，应同步更新该文档中的事件表。

---

## 技术栈（摘要）

- **框架**：Next.js 16，React 19  
- **样式**：Tailwind CSS 4，Radix UI，Framer Motion  
- **Markdown / AI UI**：`react-markdown`、`marked`、`ai`（Vercel AI SDK）等  

对本仓库 Next 版本的约定与注意事项，见 **`AGENTS.md`**。

---

## 相关文档

- 根目录 [`README.md`](../README.md)：全栈说明、Docker、后端配置与 API 摘要  
- [`doc/frontend-integration.md`](../doc/frontend-integration.md)：前端对接契约  
- [`doc/api-documentation.md`](../doc/api-documentation.md)：文档策略与 OpenAPI 分工  
