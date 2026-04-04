package com.tcm.inquiry.modules.knowledge.dto.resp;

import java.time.Instant;

public record KnowledgeFileView(
        Long id,
        String originalFilename,
        String fileUuid,
        long sizeBytes,
        String contentType,
        /** 已向量化分块数；旧数据可能为 null */
        Integer embedChunkCount,
        Instant createdAt) {}
