# doc/ — AI 可读索引（编码助手优先）

本目录存放**前后端集成契约**与**文档编写策略**，不替代运行中的 OpenAPI。人类开发者实现 UI 或 HTTP 客户端时，建议与 [`frontend/README.md`](../frontend/README.md) 一并阅读。

```yaml
audience: [coding_assistant, llm, human_developer]
project: tcm-intelligent-inquiry
backend_stack: FastAPI
truth_source_order:
  - "运行中的 GET {BASE}/openapi.json（字段级唯一真相）"
  - "本目录 Markdown（集成约定、SSE 协议、多租户行为）"
```

## 阅读顺序（对 AI）

1. **`frontend-integration.md`** — 前端/客户端对接：鉴权头、SSE 事件枚举、匿名会话状态机、错误码。实现 UI 或 API 客户端时**先读此文件**。
2. **`api-documentation.md`** — OpenAPI 与本文档如何分工；何时引用 `openapi.json`；不要重复手写全套 REST。
3. **`README.md`**（本文件）— 索引与上述顺序。

## 文件清单

| 路径 | 用途 |
|------|------|
| `frontend-integration.md` | 集成契约：HTTP+SSE，含可解析的字段表与步骤 |
| `api-documentation.md` | 文档策略与 AI 上下文加载策略 |

## 硬约束（全局）

- **不得**在业务代码中假设本文档与 `openapi.json` 冲突时以本文档为准；**以 OpenAPI 为准**修正实现或文档。
- **SSE** 的 `type` 扩展若后端新增，以 `backend/app/chat/service.py` 为准，并应同步更新 `frontend-integration.md` 中的事件表。

## 相关入口

| 文档 | 用途 |
|------|------|
| [仓库根 README.md](../README.md) | 全栈功能、Docker、环境变量、测试 |
| [backend/README.md](../backend/README.md) | 后端目录说明与命令速查 |
| [frontend/README.md](../frontend/README.md) | 前端 env、脚本与 CORS 协作 |
| [backend/alembic/README](../backend/alembic/README) | 数据库迁移流程与 stamp 注意点 |
