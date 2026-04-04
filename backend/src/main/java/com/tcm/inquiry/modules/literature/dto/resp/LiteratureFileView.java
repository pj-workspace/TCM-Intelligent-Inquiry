package com.tcm.inquiry.modules.literature.dto.resp;

import java.time.Instant;

import com.tcm.inquiry.modules.literature.entity.LiteratureUploadStatus;

public record LiteratureFileView(
        Long id,
        String tempCollectionId,
        String originalFilename,
        String fileUuid,
        long sizeBytes,
        String contentType,
        LiteratureUploadStatus status,
        Instant createdAt,
        /** 临时库统一过期时间；null 表示历史数据或未启用字段 */
        Instant expiresAt) {}
