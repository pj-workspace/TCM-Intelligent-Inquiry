from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """从环境变量 / backend/.env 加载全局配置，无论从哪个目录启动均可正确解析。"""

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── 对话模型厂商（llm_provider）────────────────────────────────────────────
    llm_provider: str = Field(
        default="qwen",
        description="qwen | openai | anthropic | glm | deepseek",
    )

    # ── 阿里云 DashScope（通义千问对话 + 默认向量嵌入）──────────────────────────
    dashscope_api_key: str = Field(
        default="",
        description="DashScope API Key；llm_provider=qwen 或知识库嵌入必填",
    )
    qwen_chat_model: str = Field(
        default="qwen-plus", description="对话模型名（兼容 OpenAI 接口）"
    )
    qwen_embedding_model: str = Field(
        default="text-embedding-v3", description="DashScope 向量模型名"
    )
    dashscope_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        description="兼容模式 Base URL",
    )
    # 检索重排序（DashScope gte-rerank，与向量同一 API Key）
    rerank_enabled: bool = Field(default=True, description="是否在向量召回后做重排序")
    dashscope_rerank_model: str = Field(
        default="gte-rerank",
        description="DashScope 重排序模型名",
    )
    rerank_candidate_multiplier: int = Field(
        default=4,
        ge=2,
        le=10,
        description="相对 top_k 的召回倍数（先多召回再重排）",
    )
    rerank_max_candidates: int = Field(
        default=40,
        ge=10,
        le=100,
        description="单次检索送入重排序的最大候选条数上限",
    )

    # ── OpenAI 官方 API ────────────────────────────────────────────────────────
    openai_api_key: str = Field(default="", description="OPENAI_API_KEY")
    openai_base_url: str = Field(
        default="https://api.openai.com/v1",
        description="OpenAI 兼容 Base URL",
    )
    openai_chat_model: str = Field(default="gpt-4o-mini", description="对话模型名")

    # ── Anthropic Claude ───────────────────────────────────────────────────────
    anthropic_api_key: str = Field(default="", description="ANTHROPIC_API_KEY")
    anthropic_chat_model: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Claude 模型名",
    )

    # ── 智谱 GLM（OpenAI 兼容接口）──────────────────────────────────────────────
    zhipu_api_key: str = Field(default="", description="智谱 AI API Key")
    glm_base_url: str = Field(
        default="https://open.bigmodel.cn/api/paas/v4",
        description="智谱 OpenAI 兼容 Base URL",
    )
    glm_chat_model: str = Field(default="glm-4", description="GLM 对话模型名")

    # ── DeepSeek（OpenAI 兼容接口）────────────────────────────────────────────
    deepseek_api_key: str = Field(default="", description="DeepSeek API Key")
    deepseek_base_url: str = Field(
        default="https://api.deepseek.com/v1",
        description="DeepSeek Base URL",
    )
    deepseek_chat_model: str = Field(default="deepseek-chat", description="对话模型名")

    # ── 基础设施（docker-compose 默认值见 .env.example）──────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://tcm:tcm_secret@127.0.0.1:5433/tcm",
        description="异步 SQLAlchemy 连接串",
    )
    redis_url: str = Field(
        default="redis://127.0.0.1:6379/0",
        description="Redis 连接串",
    )
    # 异步入库：True 时走 Celery worker；False 时用 FastAPI BackgroundTasks（无需单独 worker）
    celery_ingest_enabled: bool = Field(
        default=True,
        description="是否用 Celery 执行 ingest-async 任务",
    )
    qdrant_url: str = Field(
        default="http://127.0.0.1:6333",
        description="Qdrant HTTP 地址",
    )
    # 未在工具参数中指定 kb_id 时使用；为空则自动选用数据库中第一个知识库
    default_knowledge_base_id: str = Field(
        default="",
        description="默认知识库 UUID（可选）",
    )

    # ── JWT（登录鉴权）────────────────────────────────────────────────────────
    jwt_secret: str = Field(
        default="dev-only-change-me-use-long-random-string",
        description="HS256 密钥，生产环境务必修改",
    )
    jwt_expire_minutes: int = Field(default=10080, description="Token 有效期（分钟），默认 7 天")

    # ── 服务 ──────────────────────────────────────────────────────────────────
    cors_origins: str = Field(
        default="http://localhost:3000", description="逗号分隔的允许跨域来源"
    )

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def database_url_sync(self) -> str:
        """供 Alembic / 同步脚本使用（psycopg2）。"""
        u = self.database_url
        if "postgresql+asyncpg://" in u:
            return u.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        return u


@lru_cache
def get_settings() -> Settings:
    return Settings()
