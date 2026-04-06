package com.tcm.inquiry.modules.knowledge.ai.retrieval;

import com.fasterxml.jackson.annotation.JsonValue;

/** 知识库混合召回中单条摘录的匹配来源（供前端与 Prompt 约束）。 */
public enum KnowledgeRetrievalMatchType {
    SEMANTIC("semantic"),
    KEYWORD("keyword"),
    HYBRID("hybrid");

    private final String wire;

    KnowledgeRetrievalMatchType(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String getWire() {
        return wire;
    }
}
