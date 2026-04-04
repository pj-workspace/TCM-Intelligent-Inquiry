package com.tcm.inquiry.modules.literature.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tcm.inquiry.modules.knowledge.ai.VectorStoreFilterDeletion;
import com.tcm.inquiry.modules.literature.dto.resp.LiteratureFileView;
import com.tcm.inquiry.modules.literature.entity.LiteratureUpload;
import com.tcm.inquiry.modules.literature.repository.LiteratureUploadRepository;

@Service
public class LiteratureManageService {

    private final LiteratureUploadRepository literatureUploadRepository;
    private final VectorStoreFilterDeletion vectorStoreFilterDeletion;

    public LiteratureManageService(
            LiteratureUploadRepository literatureUploadRepository,
            VectorStoreFilterDeletion vectorStoreFilterDeletion) {
        this.literatureUploadRepository = literatureUploadRepository;
        this.vectorStoreFilterDeletion = vectorStoreFilterDeletion;
    }

    @Transactional(readOnly = true)
    public List<LiteratureFileView> listAll() {
        return literatureUploadRepository.findAll().stream()
                .map(LiteratureManageService::toView)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LiteratureFileView> listCollection(String tempCollectionId) {
        return literatureUploadRepository
                .findByTempCollectionIdOrderByCreatedAtDesc(tempCollectionId)
                .stream()
                .map(LiteratureManageService::toView)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteCollection(String tempCollectionId) {
        if (!literatureUploadRepository.existsByTempCollectionId(tempCollectionId)) {
            throw new IllegalArgumentException("literature collection not found: " + tempCollectionId);
        }

        List<LiteratureUpload> rows =
                literatureUploadRepository.findByTempCollectionIdOrderByCreatedAtDesc(tempCollectionId);

        vectorStoreFilterDeletion.deleteByFilter(
                new FilterExpressionBuilder().eq("lit_collection_id", tempCollectionId).build());

        for (LiteratureUpload u : rows) {
            deleteStoredFile(u.getStoredRelativePath());
        }
        literatureUploadRepository.deleteByTempCollectionId(tempCollectionId);
    }

    @Transactional
    public void deleteFile(String tempCollectionId, String fileUuid) {
        LiteratureUpload row =
                literatureUploadRepository
                        .findByTempCollectionIdAndFileUuid(tempCollectionId, fileUuid)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "file not in collection: " + fileUuid));

        vectorStoreFilterDeletion.deleteByFilter(
                new FilterExpressionBuilder().eq("file_id", fileUuid).build());

        deleteStoredFile(row.getStoredRelativePath());
        literatureUploadRepository.delete(row);
    }

    private static void deleteStoredFile(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }
        Path p = Paths.get(relativePath).normalize();
        try {
            Files.deleteIfExists(p);
        } catch (IOException ignored) {
        }
    }

    private static LiteratureFileView toView(LiteratureUpload u) {
        return new LiteratureFileView(
                u.getId(),
                u.getTempCollectionId(),
                u.getOriginalFilename(),
                u.getFileUuid() != null ? u.getFileUuid() : "",
                u.getSizeBytes() != null ? u.getSizeBytes() : 0L,
                u.getContentType() != null ? u.getContentType() : "application/octet-stream",
                u.getStatus(),
                u.getCreatedAt(),
                u.getExpiresAt());
    }
}
