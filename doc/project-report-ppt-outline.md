# TCM Intelligent Inquiry — 项目汇报 PPT 纲要

面向 **中医智能问询（TCM Intelligent Inquiry）** 全栈项目的演示文稿结构说明。内容依据仓库根目录 [`README.md`](../README.md)、[`backend/README.md`](../backend/README.md)、[`frontend/README.md`](../frontend/README.md) 及 [`frontend-integration.md`](frontend-integration.md) 整理；技术细节以运行中的 `GET {BASE}/openapi.json` 为准。

**使用方式**：按章节拆页；每节下的条目可对应 1 张或多张幻灯片（标题 + 要点 + 架构图/截图）。

---

## 第一部分：开场与定位（约 3～5 页）

### 1. 封面

- 项目名称：中医智能问询（TCM Intelligent Inquiry）
- 汇报人、日期、版本或里程碑标签

### 2. 背景与问题

- 中医领域知识分散：经典文献、方书、教材与机构资料并存
- 通用大模型易泛泛而谈，缺少可追溯知识与结构化方剂能力
- 需兼顾：流式对话体验、专业增强（RAG + 方剂）、扩展性（工具与 MCP）

### 3. 项目定位（一句话）

- 面向中医场景的智能问询全栈：**流式对话 + ReAct Agent + 知识库 RAG + 方剂库 + MCP 外接工具**，支持多厂商大模型切换

### 4. 建设目标（可勾选或条形呈现）

- 可对话、可溯源（检索与引用）
- 可管理知识（上传、向量化、检索 API）
- 可扩展（MCP、联网搜索等工具）
- 合规与安全提示内置

### 5. 免责声明与边界

- 系统输出仅供文化与知识参考，**不构成**医疗诊断或治疗建议
- 部署与使用需结合当地法规与产品合规要求

---

## 第二部分：总体方案与架构（约 4～6 页）

### 6. 总体架构图

- **用户层**：Web 前端（Next.js）
- **应用层**：FastAPI（REST + SSE）
- **智能层**：LangGraph ReAct Agent + 多厂商 LLM
- **数据层**：PostgreSQL（用户、会话、方剂结构化数据）、Redis（缓存/队列）、Qdrant（向量）
- **可选**：Celery Worker（大文件异步入库）、Docker Compose（基础设施）

### 7. 前后端职责划分

- **前端**：鉴权、会话 UI、SSE 解析与流式展示、设置页（知识库、MCP 等）
- **后端**：对话编排、工具调用、持久化、检索与入库管道

### 8. 核心数据流：对话一问一答

- `POST /api/chat` → SSE：多行 `data: <JSON>`，结束帧 `data: [DONE]`
- 事件类型含：`notice`、`meta`、`text-delta`、`thinking-delta`、`tool-call`、`tool-result`、`error`（详见 [`frontend-integration.md`](frontend-integration.md)）
- 会话与消息持久化；支持 **JWT 登录**与**匿名会话**（`anonSessionSecret` + `X-Anonymous-Session`）

### 9. 知识增强数据流（RAG）

- 文档：**PDF / DOCX / 文本** → 解析 → 嵌入（如 DashScope）→ **Qdrant** 存储
- 检索：向量召回 → 可选 **DashScope gte-rerank** 重排序
- Agent 工具 **`search_tcm_knowledge`** 与 HTTP 检索 API **共用**同一套检索逻辑

### 10. 方剂库与 Agent 工具

- **PostgreSQL** 结构化存储（与向量知识库分离）
- 工具：**`formula_lookup`**（方名）、**`recommend_formulas`**（症状/证型线索）
- 推荐：**关键词分 + `pg_trgm` 相似度 + `simple` 全文 OR**；同义词组见 `backend/data/symptom_synonyms.json`（不改表结构）

---

## 第三部分：功能模块详解（约 6～8 页）

### 11. 对话与 Agent

- LangGraph **`create_react_agent`（ReAct）**
- 流式输出 + 工具调用过程可展示（`runId` 配对 `tool-call` / `tool-result`）
- 可选深度思考：Qwen 时 `reasoning_content` 映射为 **`thinking-delta`**（见集成文档与 `app/llm/providers/qwen.py`）

### 12. 认证与安全

- 注册 / 登录 / JWT；**`/api/auth/me`**
- 可选 **`API_KEY`**：请求头 `X-API-Key`（与 OpenAPI 各路由要求一致）
- 系统提示与流式首包携带 **中医咨询合规提示**（非诊疗声明）

### 13. 知识库管理

- 知识库 CRUD、上传、入库；**同步**（FastAPI `BackgroundTasks`）或 **Celery 异步**（`CELERY_INGEST_ENABLED`）
- 多租户：知识库 `owner_id` 等以 OpenAPI 为准

### 14. MCP 集成

- 注册 MCP 服务（**Streamable HTTP / SSE**）
- 工具自动包装为 LangChain 工具（**`mcp_*` 前缀**）挂入 Agent
- URL 策略、健康探测等服务端能力见 `backend/app/mcp/`

### 15. 多模型与配置运营

- **`LLM_PROVIDER`**：`qwen` / `openai` / `anthropic` / `glm` / `deepseek` 等；OpenAI 兼容接口统一 `ChatOpenAI`
- Qwen 可选 **`QWEN_CHAT_MODEL_OPTIONS`**：前端下拉、`chat_model` 白名单、`capabilities`（工具调用、深度思考、联网有效条件等）
- **配置热切换**：修改 `.env` 后多数 LLM/重排相关配置在**下一轮请求**生效；**数据库连接串、Redis、Celery worker** 等仍以进程启动时为准，变更后需重启对应进程

### 16. 联网与其它工具（若已部署）

- 如 **SearXNG**、`searx_web_search`：与 `web_search_enabled`、`supports_tool_calling` 等能力联动（以根 README 为准）

### 17. 对象存储（可选）

- **阿里云 OSS**：聊天图片上传与短时签名 URL，供多模态模型使用（`POST /api/storage/oss/chat-image`）

---

## 第四部分：技术实现要点（约 3～5 页）

### 18. 技术栈清单

| 层次 | 技术 |
|------|------|
| 后端运行时 | Python 3.11+、FastAPI、Uvicorn |
| Agent | LangGraph、LangChain |
| 数据 | PostgreSQL（AsyncPG + SQLAlchemy）、Redis、Qdrant |
| 任务 | Celery（Redis broker/backend） |
| 文档解析 | pypdf、python-docx |
| MCP | 官方 `mcp` Python 包（Streamable HTTP / SSE） |
| 前端 | Next.js 16、React 19、Tailwind CSS 4、Radix UI、Framer Motion、Vercel AI SDK 等 |

### 19. 工程化

- **Alembic** 数据库迁移；`alembic upgrade head` / stamp 注意点见根 README
- **`pytest`**：集成测试依赖本机 Postgres、Redis、Qdrant 及有效 `.env`
- **OpenAPI**（`/docs`、`/openapi.json`）为字段级真相；`doc/` 为集成契约

### 20. 部署与运维

- **`docker compose`**：Postgres、Redis、Qdrant；可选 **`--profile worker`** 启动 Celery
- 健康检查：**`GET /health`**、**`GET /health/deps`**
- 默认端口映射（避免与本机冲突）：如 Postgres **5434**、Redis **6381**、Qdrant **7333** 等（以 `docker-compose.yml` 为准）

---

## 第五部分：成果展示与验证（约 2～4 页）

### 21. 演示脚本建议

1. 登录 → 多轮对话  
2. 触发 **知识库检索** / **方剂推荐**  
3. （可选）展示 **MCP 工具** 调用  
4. 强调 SSE：**工具卡片**、**思考过程**、**安全首包**

### 22. 测试与质量

- 后端 `backend/tests/`：Agent 集成、聊天访问、MCP 格式、联网工具等
- 可列举 1～2 个业务向用例（如方名查询、证型/症状线索推荐）

### 23. 已知限制与风险

- 匿名会话与知识库工具行为受 **`DEFAULT_KNOWLEDGE_BASE_ID`** 等配置约束
- 嵌入/重排若依赖 DashScope：需管理与成本
- 模型幻觉与医学合规：依赖提示词、RAG、产品与法务流程

---

## 第六部分：规划与收尾（约 2～3 页）

### 24. 后续迭代方向（按实际裁剪）

- 多模态产品化与评测集、离线指标  
- 权限审计、租户隔离强化  
- 更多内置中医知识源与领域评测  

### 25. 总结

- **价值**：专业场景下「可对话、可检索、可扩展」的平台化能力  
- **差异化**：RAG + 结构化方剂 + MCP + 多模型与热切换配置  

### 26. Q&A

---

## 附录（可选幻灯片）

### A. 主要 HTTP API（摘要）

| 前缀 | 说明 |
|------|------|
| `POST /api/auth/register`、`/login`；`GET /api/auth/me` | 注册、登录、当前用户 |
| `POST /api/chat` | 流式对话（SSE） |
| `GET /api/chat/model-options` | Qwen 多模型配置时返回选项 |
| `GET /api/chat/conversations`、`.../messages` | 会话与消息 |
| `GET/POST /api/knowledge` 等 | 知识库、上传、检索、异步入库与任务状态 |
| `GET/POST /api/mcp` 等 | MCP 服务管理 |
| `GET /health`、`GET /health/deps` | 健康与依赖 |

### B. SSE 事件类型（约定集合）

| type | 语义（节选） |
|------|----------------|
| `notice` | 安全提示 |
| `meta` | 新会话；含 `conversationId`、匿名时 `anonSessionSecret` 等 |
| `text-delta` | 助手正文增量 |
| `thinking-delta` | 思考/推理增量（展示用） |
| `tool-call` / `tool-result` | 工具开始/结束 |
| `error` | 错误 |

完整字段见 [`frontend-integration.md`](frontend-integration.md) 第三节。

### C. 仓库目录（汇报用简图）

```text
tcm-intelligent-inquiry/
├── docker-compose.yml
├── doc/
├── backend/          # FastAPI、Agent、知识库、MCP、Celery
│   ├── main.py
│   ├── celery_app.py
│   ├── app/agent/    # ReAct、工具注册
│   ├── app/chat/     # 流式对话、会话
│   ├── app/knowledge/
│   ├── app/mcp/
│   ├── app/llm/
│   └── data/         # 方剂等种子 JSON
└── frontend/         # Next.js 客户端
```

---

## 汇报体裁建议

- **技术向**：压缩「第一部分」篇幅，强化「第二部分架构 + 第四部分工程化 + 附录 API/SSE」  
- **业务/立项向**：强化「背景、目标、演示、合规、路线图」，架构用 1～2 页总览即可  

---

*文档版本：与仓库说明同步维护；接口与事件以 OpenAPI 与 `frontend-integration.md` 为准。*
