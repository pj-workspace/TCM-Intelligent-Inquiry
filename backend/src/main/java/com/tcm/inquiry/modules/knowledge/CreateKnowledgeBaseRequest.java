package com.tcm.inquiry.modules.knowledge;

/**
 * POST /api/v1/knowledge/bases 请求体（最小字段）。
 */
public record CreateKnowledgeBaseRequest(String name, String embeddingModel) {
}
