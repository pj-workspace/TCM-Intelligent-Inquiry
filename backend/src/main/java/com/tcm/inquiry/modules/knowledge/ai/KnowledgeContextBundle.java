package com.tcm.inquiry.modules.knowledge.ai;

import java.util.List;

import com.tcm.inquiry.modules.knowledge.dto.resp.KnowledgeRetrievedPassage;

/** 知识库检索得到的上下文片段（供 Agent 等复用，不再调用 LLM）。 */
public record KnowledgeContextBundle(
        String contextText,
        List<String> sources,
        int retrievedChunks,
        List<KnowledgeRetrievedPassage> passages) {

    public KnowledgeContextBundle(String contextText, List<String> sources, int retrievedChunks) {
        this(contextText, sources, retrievedChunks, List.of());
    }
}
