package com.tcm.inquiry.modules.agent;

import jakarta.validation.constraints.NotBlank;

/**
 * JSON：{@code POST /api/v1/agent/run}（{@code Content-Type: application/json}）。
 * 问诊前端附图推荐本类型中的 {@code herbImageBase64}，以启用 ReAct + 药材识别工具；
 * {@code multipart/form-data} 仍保留供直连视觉模型、或其它客户端使用。
 */
public record AgentRunRequest(
        @NotBlank String task,
        /** 已废弃：请用 multipart 上传图片 */
        @Deprecated String imagePath,
        Long knowledgeBaseId,
        Integer ragTopK,
        Double ragSimilarityThreshold,
        /**
         * 可选：JSON 随路传入的单张药材图 Base64；写入 ToolContext 供 {@code herb_image_recognition_tool} 调用视觉模型。
         */
        String herbImageBase64,
        /** 可选：与 herbImageBase64 对应的 MIME（如 image/png），缺省按 image/jpeg。 */
        String herbImageMimeType,
        /** 可选：默认临时文献库 ID，供 literature_retrieval_tool 未显式传 collection_id 时使用。 */
        String literatureCollectionId,
        Integer literatureRagTopK,
        Double literatureSimilarityThreshold) {}
