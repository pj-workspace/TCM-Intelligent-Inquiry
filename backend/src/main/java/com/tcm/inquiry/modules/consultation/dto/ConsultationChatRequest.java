package com.tcm.inquiry.modules.consultation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 流式问诊请求。temperature / topP / maxHistoryTurns 可选，由服务端设默认值。
 */
public class ConsultationChatRequest {

    @NotNull
    private Long sessionId;

    @NotBlank
    private String message;

    /** 覆盖 Ollama 采样温度；null 时使用服务端默认（如 0.7）。 */
    private Double temperature;

    /**
     * 覆盖 Ollama nucleus 采样 top_p；null 时使用服务端默认（如 0.9）。 值越大则候选词集合越宽。
     */
    private Double topP;

    /**
     * 参与上下文的历史「轮数」，每轮对应一条 {@link com.tcm.inquiry.modules.consultation.entity.ChatMessage}；
     * null 时使用服务端默认（如 10）。
     */
    private Integer maxHistoryTurns;

    /** 可选：检索该知识库中与当前主诉相关的摘录，注入本轮模型输入（不落库改写用户原文）。 */
    private Long knowledgeBaseId;

    /** 覆盖知识库检索 topK；仅当 knowledgeBaseId 非空时有效。 */
    private Integer ragTopK;

    /** 覆盖知识库相似度阈值；仅当 knowledgeBaseId 非空时有效。 */
    private Double ragSimilarityThreshold;

    /**
     * 可选：检索该临时文献库中与主诉相关的摘录并注入模型输入（与 {@link #knowledgeBaseId} 互斥）。
     */
    private String literatureCollectionId;

    /** 文献检索 topK；仅当 literatureCollectionId 非空时有效。 */
    private Integer literatureRagTopK;

    /** 文献相似度阈值；仅当 literatureCollectionId 非空时有效。 */
    private Double literatureSimilarityThreshold;

    public Long getSessionId() {
        return sessionId;
    }

    public void setSessionId(Long sessionId) {
        this.sessionId = sessionId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Double getTopP() {
        return topP;
    }

    public void setTopP(Double topP) {
        this.topP = topP;
    }

    public Integer getMaxHistoryTurns() {
        return maxHistoryTurns;
    }

    public void setMaxHistoryTurns(Integer maxHistoryTurns) {
        this.maxHistoryTurns = maxHistoryTurns;
    }

    public Long getKnowledgeBaseId() {
        return knowledgeBaseId;
    }

    public void setKnowledgeBaseId(Long knowledgeBaseId) {
        this.knowledgeBaseId = knowledgeBaseId;
    }

    public Integer getRagTopK() {
        return ragTopK;
    }

    public void setRagTopK(Integer ragTopK) {
        this.ragTopK = ragTopK;
    }

    public Double getRagSimilarityThreshold() {
        return ragSimilarityThreshold;
    }

    public void setRagSimilarityThreshold(Double ragSimilarityThreshold) {
        this.ragSimilarityThreshold = ragSimilarityThreshold;
    }

    public String getLiteratureCollectionId() {
        return literatureCollectionId;
    }

    public void setLiteratureCollectionId(String literatureCollectionId) {
        this.literatureCollectionId = literatureCollectionId;
    }

    public Integer getLiteratureRagTopK() {
        return literatureRagTopK;
    }

    public void setLiteratureRagTopK(Integer literatureRagTopK) {
        this.literatureRagTopK = literatureRagTopK;
    }

    public Double getLiteratureSimilarityThreshold() {
        return literatureSimilarityThreshold;
    }

    public void setLiteratureSimilarityThreshold(Double literatureSimilarityThreshold) {
        this.literatureSimilarityThreshold = literatureSimilarityThreshold;
    }
}
