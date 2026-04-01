# Contributing

## 环境与构建

- **后端**：JDK 17+，`cd backend && ./mvnw test`；真机 Ollama 集成测试需设置 `OLLAMA_LIVE=true` 与 `ci` profile（见 CI 工作流）。
- **前端**：Node 22+（与 CI 一致），`cd frontend && npm ci && npm run build && npm run lint && npm test`。

## Pull request

- 一次 PR 聚焦单一主题，提交信息用完整句子说明动机与行为变化。
- 后端业务改动放在对应模块包：`modules/consultation|knowledge|literature|agent`；新增 JPA 实体时在本包内增加 `*JpaConfig`（与现有模块一致）。
- 确保 `backend` 测试与 `frontend` 的 `lint` / `build` / `test` 在本地通过。

## 安全

请勿在 issue 或 PR 中张贴可利用的漏洞细节；请参阅 [SECURITY.md](SECURITY.md)。
