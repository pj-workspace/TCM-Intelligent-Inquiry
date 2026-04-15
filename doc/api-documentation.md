# API 文档策略（AI 可读）

```yaml
purpose: 说明 OpenAPI 与 doc/  markdown 的分工，避免重复维护与歧义
primary_field_truth: GET {BASE_URL}/openapi.json
```

## 1. 真相来源层级

| 优先级 | 来源 | 用途 |
|--------|------|------|
| 1 | `{BASE_URL}/openapi.json` | 路径、方法、请求/响应模型、Query、Header、鉴权依赖 — **实现请求代码时以此为准** |
| 2 | `{BASE_URL}/docs` | 人类可点的 Swagger；与 openapi.json 一致 |
| 3 | `doc/frontend-integration.md` | OpenAPI **不易表达**的约定：SSE 行格式、`type` 枚举、匿名会话头、CORS |

若 2 与 1 不一致，以运行中的 **openapi.json** 为准（视为后端版本）。

## 2. 是否另写「完整接口手册」

- **否**：不要维护第三份与 OpenAPI 逐字段重复的 Word/Markdown 全书。
- **是**：在 `doc/` 保留 **集成向** 短文（SSE、鉴权、多租户语义），与 OpenAPI **互补**。

## 3. 给编码助手加载上下文的建议

```text
任务：实现某 REST 调用
  → 优先 @ 引用 openapi.json（或本仓库内导出的 openapi 快照，若有）
任务：实现聊天 SSE 解析、匿名会话、工具事件 UI
  → 优先 @ 引用 doc/frontend-integration.md
任务：核对某字段是否必填
  → 只信 openapi.json 中该 operation 的 schema
```

## 4. 何时在仓库中提交 openapi 快照（可选）

- 目的：CI/离线/无法启动服务时仍能给 AI 读字段。
- 做法：发版脚本 `curl -s {BASE}/openapi.json -o doc/openapi.snapshot.json`（文件名自定），并在 `doc/README.md` 注明**生成日期**；**运行时仍以服务端 `/openapi.json` 为最新**。

## 5. 非 HTTP 说明

队列、Webhook、运维权限矩阵等若存在，在 `doc/` **单独增文**，不塞进 OpenAPI。
