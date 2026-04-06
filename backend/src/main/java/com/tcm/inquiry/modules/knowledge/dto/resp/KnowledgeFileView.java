package com.tcm.inquiry.modules.knowledge.dto.resp;

import java.time.Instant;

import com.tcm.inquiry.modules.knowledge.entity.IngestionStatus;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeFile;

public record KnowledgeFileView(
        Long id,
        String originalFilename,
        String fileUuid,
        long sizeBytes,
        String contentType,
        /** 已向量化分块数；排队中 / 处理中 / 旧数据可能为 null */
        Integer embedChunkCount,
        Instant createdAt,
        IngestionStatus status,
        String errorMessage) {

    /**
     * 将实体转为 API 视图；未迁移的历史行 {@code status == null} 视为已成功完成的旧数据。
     */
    public static KnowledgeFileView fromEntity(KnowledgeFile f) {
        IngestionStatus st = f.getStatus() != null ? f.getStatus() : IngestionStatus.COMPLETED;
        return new KnowledgeFileView(
                f.getId(),
                f.getOriginalFilename(),
                f.getFileUuid(),
                f.getSizeBytes(),
                f.getContentType(),
                f.getEmbedChunkCount(),
                f.getCreatedAt(),
                st,
                f.getErrorMessage());
    }
}
