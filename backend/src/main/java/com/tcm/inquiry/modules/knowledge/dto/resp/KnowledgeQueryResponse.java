package com.tcm.inquiry.modules.knowledge.dto.resp;

import java.util.List;

public record KnowledgeQueryResponse(
        String answer,
        List<String> sources,
        int retrievedChunks,
        List<KnowledgeRetrievedPassage> passages) {

    public KnowledgeQueryResponse(String answer, List<String> sources, int retrievedChunks) {
        this(answer, sources, retrievedChunks, List.of());
    }
}
