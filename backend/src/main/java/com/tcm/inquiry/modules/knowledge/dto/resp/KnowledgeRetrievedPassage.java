package com.tcm.inquiry.modules.knowledge.dto.resp;

import com.tcm.inquiry.modules.knowledge.ai.retrieval.KnowledgeRetrievalMatchType;

/**
 * 单条检索摘录的元数据，用于前端展示与溯源（与 {@link org.springframework.ai.document.Document} 解耦）。
 */
public record KnowledgeRetrievedPassage(
        int index,
        String documentId,
        String source,
        KnowledgeRetrievalMatchType matchType,
        /** 归一化后的综合相关分，约 ∈ [0,1]，越大越靠前 */
        double score) {}
