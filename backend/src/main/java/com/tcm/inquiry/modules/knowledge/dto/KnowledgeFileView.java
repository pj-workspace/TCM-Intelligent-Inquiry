package com.tcm.inquiry.modules.knowledge.dto;

import java.time.Instant;

public record KnowledgeFileView(
        Long id,
        String originalFilename,
        String fileUuid,
        long sizeBytes,
        String contentType,
        Instant createdAt) {}
