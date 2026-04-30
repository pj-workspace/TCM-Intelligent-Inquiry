# TCM Intelligent Inquiry — 后端

本目录为 **中医智能问询** 服务端：**FastAPI** 提供 REST 与 **SSE 流式对话**；**LangGraph / LangChain** 驱动 ReAct Agent；**PostgreSQL** 持久化用户与会话；**Qdrant** 向量检索与可选重排；可选 **Celery** 异步入库。

---

## 与仓库其他部分的关系

| 路径 | 说明 |
|------|------|
| 仓库根 [`README.md`](../README.md) | **主文档**：功能矩阵、Docker Compose、完整环境变量说明、API 表、测试与免责声明 |
| [`../frontend/`](../frontend/) | Next.js 前端；通过 `NEXT_PUBLIC_API_BASE_URL` 指向本服务 |
| [`../doc/`](../doc/) | 集成契约（SSE、鉴权、`openapi.json` 分工） |

首次部署或贡献代码建议：**先读根目录 README**，再读本文件与 `doc/`。

---

## 目录结构（高层）

| 路径 | 职责 |
|------|------|
| `main.py` | FastAPI 应用入口（Uvicorn 加载 `main:app`） |
| `celery_app.py` | Celery 应用（大文件异步入库队列 `tcm`） |
| `app/agent/` | ReAct Agent、工具注册（知识库检索、方剂、MCP 等） |
| `app/auth/` | 注册、登录、JWT |
| `app/chat/` | 流式对话、会话与消息 |
| `app/knowledge/` | 知识库 CRUD、解析、向量、检索与重排 |
| `app/mcp/` | MCP 服务注册与 LangChain 桥接 |
| `app/llm/` | 多厂商对话与嵌入工厂 |
| `app/core/` | 配置、数据库、安全文案等横切能力 |
| `app/storage/` | 对象存储（如阿里云 OSS 上传与签名 URL） |
| `data/` | 内置种子（如方剂、症状同义词 JSON） |
| `tests/` | `pytest` 用例 |
| `alembic/` | 数据库迁移脚本（说明见 `alembic/README`） |

---

## 快速命令（速查）

在 **`backend/`** 目录下执行（需已创建虚拟环境并 `pip install -r requirements.txt`）：

```bash
# 数据库迁移到最新
alembic upgrade head

# 启动 API
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 单元 / 集成测试（依赖本机 Postgres、Redis、Qdrant 及有效 .env，见根 README）
pytest
```

可选 Celery Worker：

```bash
celery -A celery_app worker -l info -Q tcm
```

配置从 **`backend/.env`** 读取；模板见 **`.env.example`**。关于 **Alembic 与 `init_db`** 的互斥/ stamp 说明，以根目录 README 中的表格为准。

---

## 配置热切换（摘要）

多数与 LLM、重排、JWT、上传上限等相关的变量在保存 `.env` 后**下一轮 HTTP 请求**即可生效，无需重启 Uvicorn。**数据库连接串**、在启动时创建的异步引擎等变更仍需重启 API 进程；Celery worker 配置变更需重启 worker。细节见根 README「功能概览」与 `.env.example` 顶部注释。

---

## 阿里云 OSS（聊天图片）

在 `.env` 中配置 `ALIYUN_OSS_*`（见 `.env.example`）后，`POST /api/storage/oss/chat-image`（multipart，需登录 Bearer）将把图片写入 Bucket，并在响应里返回 **`url`（短时有效的签名 GET URL）**，便于将 `image_url` 传给通义 VL 等多模态接口。Bucket 内需与 Endpoint 地域一致；AccessKey 建议单独 RAM 权限与定期轮换。

---

## OpenAPI

启动服务后：

- Swagger UI：`http://127.0.0.1:8000/docs`
- OpenAPI JSON：`http://127.0.0.1:8000/openapi.json`

与手写文档不一致时，以 OpenAPI 为准。
