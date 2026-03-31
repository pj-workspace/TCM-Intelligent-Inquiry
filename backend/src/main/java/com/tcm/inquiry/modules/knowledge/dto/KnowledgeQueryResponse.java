package com.tcm.inquiry.modules.knowledge.dto;

import java.util.List;

public record KnowledgeQueryResponse(String answer, List<String> sources, int retrievedChunks) {}
