package com.tcm.inquiry.modules.knowledge.ai;

/**
 * 向量存储后端类型（持久化为字符串）。
 */
public enum VectorBackend {
    /** @deprecated 历史数据；新库请使用 {@link #DASHSCOPE} */
    @Deprecated
    OLLAMA,
    /** 阿里云 DashScope OpenAI 兼容嵌入（如 text-embedding-v4） */
    DASHSCOPE,
    PGVECTOR,
    CHROMA,
    IN_MEMORY
}
