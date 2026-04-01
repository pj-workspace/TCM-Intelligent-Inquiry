# Security policy

## 报告漏洞

若你发现安全相关漏洞，请通过私下渠道联系仓库维护者（请勿在公开 issue 中披露可利用细节）。我们会在合理时间内评估与修复。

## API 暴露与访问控制（选型建议）

本仓库默认**不提供**登录与 Spring Security；适用于可信内网或已由反向代理完成鉴权的部署。

| 场景 | 建议 |
|------|------|
| 仅团队内网 / VPN | 网络层隔离 + 可选 IP 白名单；后端 `spring.profiles.active=prod`，设置 `tcm.api.expose-error-details=false` 与收紧 `tcm.api.cors-allowed-origin-patterns`。 |
| 面向公网 | **勿**将 API 直接暴露在公网；在网关（Nginx、云 WAF、API Gateway）做 HTTPS、认证（如 OIDC / API Key）与**限流**（对 `/api/v1/consultation/chat`、上传与 ingest 重点限制）。 |
| 需应用层登录 | 自行引入 **Spring Security**（如 JWT / Session）与前端登录流，对删除知识库、文献与 ingest 等敏感操作做角色控制。 |

## 配置项（摘要）

- `tcm.api.expose-error-details`：为 `false` 时，未捕获异常的 HTTP 500 与部分 IO 错误仅返回通用文案，详细堆栈仅记日志。
- `tcm.api.cors-allowed-origin-patterns`：生产环境应列为具体前端来源，避免长期使用 `*`。
- 生产配置示例：[backend/src/main/resources/application-prod.yml](backend/src/main/resources/application-prod.yml)。

## 网关限流示例（Nginx）

可对 API 路径单独 `limit_req`，例如（需按 QPS 调整）：

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
location /api/ {
  limit_req zone=api_limit burst=20 nodelay;
  proxy_pass http://backend:8080;
}
```

## 密钥与依赖

- 勿将云厂商 LLM API Key、数据库口令等提交到仓库；生产使用环境变量或密钥管理服务。
- 建议在 CI 中定期执行 `npm audit` 与关注 Maven 依赖公告（见 [.github/workflows/ci.yml](.github/workflows/ci.yml)）。
