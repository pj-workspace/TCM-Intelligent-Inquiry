# TCM-Intelligent-Inquiry
An AI-powered Traditional Chinese Medicine (TCM) intelligent inquiry system for symptom analysis, constitution identification, and personalized health recommendations

## Development

- **Backend (Spring Boot 3.3+, Java 17+)**: `cd backend && ./mvnw -q -DskipTests compile` (or `mvn -q -f backend/pom.xml -DskipTests compile`). Run: `./mvnw spring-boot:run` (port **8080**). SQLite file: `backend/data/tcm-inquiry.db` (directory created on startup). **Ollama** base URL defaults to `http://localhost:11434` in `backend/src/main/resources/application.yml`.
- **Spring AI / Ollama**: Spring AI **1.0.x** uses the dependency `spring-ai-starter-model-ollama` (managed by `spring-ai-bom`; replaces the older `spring-ai-ollama-spring-boot-starter` milestone artifact).
- **Frontend (Vue 3 + Vite)**: `cd frontend && npm install && npm run dev`. Dev server proxies `/api` → `http://localhost:8080`.
- **并行开发（多 Composer / fast）**：`backend/pom.xml` 与主 `application.yml` 仅由 **WS1（backend-platform）** 修改；业务仅限各自包：`modules/consultation|knowledge|literature|agent`、`frontend/`。各模块若新增 JPA 实体，须在本包内增加 `*JpaConfig`（`@EntityScan` + `@EnableJpaRepositories`），与咨询/知识/文献现状一致。

### 阶段一：中医问诊流式对话（已打通）

- **后端**：`POST /api/v1/consultation/chat`（`Content-Type: application/json`，`Accept: text/event-stream`）请求体字段：`sessionId`、`message`、可选 `temperature`、`maxHistoryTurns`。响应为 SSE：`data:` 为增量文本，结束前发送 `data:[DONE]`；流结束后异步写入 `chat_messages`。系统提示词见 `ConsultationPrompts.SYSTEM`。历史：`GET /api/v1/consultation/sessions/{id}/messages`。
- **前端**：问诊页使用 `useChat` + `openSseStream` 对接上述接口；需本机 **Ollama** 已启动且配置模型可用。

### 阶段二：中医药知识库与全局 RAG（已打通 MVP）

- **依赖**：`spring-ai-tika-document-reader`（PDF/Word/TXT 等经 Tika 抽取文本）、既有 `SimpleVectorStore` + Ollama `EmbeddingModel`（默认 `bge-m3:latest`）。
- **元数据**：向量文档带 `kb_id`、`file_id`、`source`（文件名），检索与删除按 `kb_id` / `file_id` 过滤。
- **接口**（均前缀 `/api/v1/knowledge`）：
  - `POST /bases` 创建知识库；`GET /bases` 列表；
  - `POST /bases/{kbId}/documents`：`multipart/form-data`，字段 `file`，可选 `chunkSize`；
  - `GET /bases/{kbId}/documents`：已上传文件列表；`DELETE /bases/{kbId}/documents/{fileUuid}`：删文件并删向量；
  - `POST /bases/{kbId}/query`：JSON `{ message, topK?, similarityThreshold? }` → RAG 非流式回答。
- **配置**：`application.yml` 中 `tcm.knowledge.*`（分块与检索默认参数）、`spring.servlet.multipart` 大小限制；文件落盘目录默认 `data/kb-files/{kbId}/`（在 `backend/data/` 下，已被 `.gitignore` 覆盖）。
- **前端**：`frontend` 知识库页可选择/创建库、上传、删除与提问。
