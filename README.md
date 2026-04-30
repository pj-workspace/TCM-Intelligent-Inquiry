# TCM Intelligent Inquiry（中医智能问询）

面向中医领域的智能问询后端：**流式对话**、**Agent 工具调用**、**MCP 集成**、**知识库 RAG（向量 + 重排序）**，支持多厂商大模型与异步入库。

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **对话** | FastAPI + SSE，LangGraph `create_react_agent`（ReAct），会话与消息持久化（PostgreSQL） |
| **认证** | 注册 / 登录 / JWT，`/api/auth/me` |
| **知识库** | 知识库 CRUD；文档入库（**PDF / DOCX / 文本**）；Qdrant 向量存储；语义检索 |
| **RAG** | DashScope 嵌入 + Qdrant 召回；可选 **DashScope gte-rerank** 重排序；Agent 工具 `search_tcm_knowledge` 与 HTTP 检索 API 共用同一套检索逻辑 |
| **方剂库** | PostgreSQL 结构化存储（与向量知识库分离）；Agent 工具 **`formula_lookup`**（方名）、**`recommend_formulas`**（症状/证型线索）；种子见 `backend/data/formulas_seed.json`；推荐融合 **关键词分 + `pg_trgm` 相似度 + `simple` 全文 OR**；同义词组见 `backend/data/symptom_synonyms.json`（不改表结构） |
| **MCP** | 注册 MCP 服务（Streamable HTTP / SSE）；工具自动包装为 LangChain 工具（`mcp_*` 前缀）挂入 Agent |
| **异步入库** | 可选 **Celery** 执行大文件入库；或 `CELERY_INGEST_ENABLED=false` 使用 FastAPI `BackgroundTasks` |
| **多模型** | 通过 `LLM_PROVIDER` 切换：`qwen` / `openai` / `anthropic` / `glm` / `deepseek`（OpenAI 兼容接口用统一 `ChatOpenAI`）；**Qwen** 可选用 `QWEN_CHAT_MODEL_OPTIONS` 做多模型与白名单 |
| **安全提示** | 系统提示与流式首包携带中医咨询**合规提示**（非诊疗声明） |
| **配置热切换** | 修改 `backend/.env` 后，**下一轮 API 请求**会重新读取 LLM / 重排等配置（无需重启 uvicorn）；数据库连接串、Redis 客户端、Celery worker 等仍以进程启动时为准，变更后需重启对应进程 |

---

## 技术栈

- **运行时**：Python 3.11+，FastAPI，Uvicorn  
- **Agent**：LangGraph，LangChain  
- **数据**：PostgreSQL（AsyncPG + SQLAlchemy），Redis，Qdrant  
- **任务**：Celery（Redis broker/backend）  
- **文档解析**：pypdf，python-docx  
- **MCP**：官方 `mcp` Python 包（Streamable HTTP / SSE 客户端）  
- **可选基础设施**：Docker Compose（Postgres、Redis、Qdrant；可选 Celery worker profile）

---

## 仓库结构（简要）

```text
tcm-intelligent-inquiry/
├── docker-compose.yml          # 本地 Postgres / Redis / Qdrant（可选 worker）
├── doc/                       # 前后端集成契约与文档策略（见 doc/README.md）
├── backend/                   # 后端；子目录说明见 backend/README.md
│   ├── main.py                 # FastAPI 入口
│   ├── celery_app.py           # Celery 应用（异步入库）
│   ├── app/
│   │   ├── agent/              # ReAct Agent、工具注册
│   │   │   └── tools/
│   │   │       └── formula/    # 方剂：ORM、检索、种子（与 formula_lookup 同域）
│   │   ├── auth/               # 用户与 JWT
│   │   ├── chat/               # 流式对话、会话
│   │   ├── knowledge/          # 知识库、向量、检索、重排、文档解析
│   │   ├── mcp/                # MCP 服务管理与 LangChain 桥接
│   │   ├── llm/                # 多厂商 chat_factory、嵌入
│   │   └── core/               # 配置、安全文案、数据库等
│   ├── data/                   # 方剂等内置种子数据（JSON）
│   ├── tests/                  # pytest
│   ├── .env.example
│   └── requirements.txt
└── frontend/                   # 前端（说明见 frontend/README.md）
```

---

## 环境要求

- Python 3.11+  
- Docker（推荐）：用于 Postgres、Redis、Qdrant  
- 阿里云 **DashScope API Key**（通义对话 / 嵌入 / 重排 gte-rerank 默认均走同一 Key；若仅使用其他厂商对话模型，嵌入与重排仍依赖 DashScope 时需保留该 Key）

---

## 快速开始

### 1. 启动基础设施

在项目根目录：

```bash
docker compose up -d
```

默认 Postgres 映射宿主 **`5434`**，Redis **`6381`**（避免与本机霸占 `127.0.0.1:6379` 的 Redis 冲突），Qdrant **`7333`**（gRPC **`7334`**），SearXNG **`9888`**。

### 2. 后端配置

```bash
cd backend
cp .env.example .env
# 编辑 .env：至少填写 DASHSCOPE_API_KEY；数据库/Redis/Qdrant 与 compose 一致
```

### 3. 安装依赖与数据库迁移

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

**Alembic 与 `init_db` 的关系**（任选一种方式建表，勿混用未对齐的 revision）：

| 情况 | 操作 |
|------|------|
| 空库，只用迁移建表 | `alembic upgrade head` |
| 表已由 API 的 `init_db`（`create_all`）建好，且结构与当前迁移一致 | 在 `backend` 下执行 **`alembic stamp head`**，把 `alembic_version` 标到最新，之后日常用 `alembic upgrade head` 即可 |
| 仅有初始迁移的表、尚未有 `mcp_servers` 等后续迁移 | `alembic stamp fe4256aec939` 后执行 `alembic upgrade head` |

可用 `alembic current` 查看当前版本；若 `alembic_version` 为空但表已存在，优先 **`alembic stamp head`**（在确认库结构已包含全部迁移对象时）。

### 4. 启动 API

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

健康检查：`GET http://localhost:8000/health`，依赖检查：`GET http://localhost:8000/health/deps`。

#### Qwen 多模型与白名单（`QWEN_CHAT_MODEL_OPTIONS`，可选）

若 `LLM_PROVIDER=qwen` 且配置了单行 JSON **`QWEN_CHAT_MODEL_OPTIONS`**（示例见 **`backend/.env.example`**），则前端可下拉切换模型，服务端对白名单 **`chat_model`** 做校验。要点：

- **`QWEN_CHAT_MODEL`** 须与 OPTIONS 中带 **`"default": true`** 的 **`id`** 一致（否则运行时 **warning**）。未启用 OPTIONS（空数组或留空）时仍只使用 **`QWEN_CHAT_MODEL`**，并忽略请求体里的 **`chat_model`**。
- **`capabilities`**：**`supports_tool_calling: false`** 时不挂载任何工具（含联网 `searx_web_search`/知识库/MCP）；联网有效条件为 **`web_search_enabled ∧ supports_tool_calling`**。**`supports_deep_think`** 决定是否允许深度思考。**`vendor_native_online_search`** 若存在仅占位。**`input`** 含 **`image`** 时前端放开附件占位，否则禁用（本条仅 UI；多模态进模型后续可做）。
- 同一会话内可随时改下拉再发下一条；**重新生成**使用**当下**所选模型，不按消息历史存档。**`GET /api/chat/model-options`** 可不携带 JWT。**非法 JSON** 或「非空 OPTIONS 但并非恰好一项 `default:true`」将导致 **Settings 校验失败**，无法在无效配置下启动。

### 5.（可选）启动 Celery Worker（异步入库）

```bash
cd backend
celery -A celery_app worker -l info -Q tcm
```

或使用 Compose（需 profile）：

```bash
docker compose --profile worker up -d worker
```

容器内数据库/Redis 主机名需使用 **服务名**（如 `postgres`、`redis`），见 `docker-compose.yml` 中 worker 的 `environment`。

---

## 配置说明（`backend/.env`）

核心变量见 **`backend/.env.example`**，主要包括：

- **`LLM_PROVIDER`**：`qwen` | `openai` | `anthropic` | `glm` | `deepseek`  
- **DashScope**：`DASHSCOPE_API_KEY`、`QWEN_CHAT_MODEL`、`QWEN_CHAT_MODEL_OPTIONS`（可选）、`QWEN_EMBEDDING_MODEL`、`DASHSCOPE_BASE_URL`  
- **检索重排序**：`RERANK_ENABLED`、`DASHSCOPE_RERANK_MODEL`、`RERANK_CANDIDATE_MULTIPLIER`、`RERANK_MAX_CANDIDATES`  
- **异步入库**：`CELERY_INGEST_ENABLED`  
- **JWT / CORS / 默认知识库 ID** 等  

其他厂商 Key 与模型名在 `.env.example` 中有注释示例。**修改 `.env` 保存后，多数对话与检索相关配置可在不重启 API 的情况下于下一轮请求生效**（例外见上文「功能概览」）。

---

## 主要 HTTP API（摘要）

| 前缀 | 说明 |
|------|------|
| `POST /api/auth/register`、`/login`、`GET /api/auth/me` | 注册、登录、当前用户 |
| `POST /api/chat` | 流式对话（SSE）；可选 `chat_model`、`deep_think`、`web_search_*` |
| `GET /api/chat/model-options` | Qwen 配置了 `QWEN_CHAT_MODEL_OPTIONS` 时返回模型与 capabilities |
| `GET /api/chat/conversations`、`.../messages` | 会话与消息列表 |
| `GET/POST /api/knowledge` 等 | 知识库与上传、检索、`ingest-async`、任务状态 |
| `GET/POST /api/mcp` 等 | MCP 服务注册、刷新工具、删除 |
| `GET /health`、`GET /health/deps` | 健康与依赖探测 |

OpenAPI 文档：启动服务后访问 `/docs`。

---

## 测试

```bash
cd backend
source .venv/bin/activate
pytest
```

集成测试依赖本机 Postgres / Redis / Qdrant 及有效 `.env`。

---

## 免责声明

本系统提供的中医相关内容仅供**文化与知识参考**，不构成医疗诊断或治疗建议，不能替代执业医师面诊。部署与使用前请结合当地法规与产品合规要求自行评估。
