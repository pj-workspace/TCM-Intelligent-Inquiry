package com.tcm.inquiry.modules.agent.tools;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * {@code literature_retrieval_tool} 入参：对「临时文献库」向量检索，与问诊原文献 RAG 参数语义一致。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LiteratureRetrievalToolArgs(
        /** 临时库 ID；可省略，此时使用 ToolContext 中的默认文献会话（若存在）。 */
        @JsonAlias("collection_id") String collectionId,
        String query,
        @JsonAlias("top_k") Integer topK,
        Double similarityThreshold) {}
