package com.tcm.inquiry.modules.knowledge.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tcm.inquiry.modules.knowledge.entity.IngestionStatus;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeFile;
import com.tcm.inquiry.modules.knowledge.repository.KnowledgeFileRepository;

/**
 * 将「状态更新」拆到独立短事务中，避免长耗时向量写入持有数据库连接或与大事务耦合。
 */
@Service
public class KnowledgeIngestionTxFacade {

    private static final int MAX_ERROR_LEN = 4000;

    private final KnowledgeFileRepository knowledgeFileRepository;

    public KnowledgeIngestionTxFacade(KnowledgeFileRepository knowledgeFileRepository) {
        this.knowledgeFileRepository = knowledgeFileRepository;
    }

    /**
     * 仅当当前为 {@link IngestionStatus#PENDING} 时转为 {@link IngestionStatus#PROCESSING}，用于任务互斥。
     *
     * @return true 表示本线程成功抢占该任务
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markProcessingIfPending(Long knowledgeFileId) {
        return knowledgeFileRepository.updateIngestionStatusWhere(
                        knowledgeFileId,
                        IngestionStatus.PENDING,
                        IngestionStatus.PROCESSING,
                        null)
                > 0;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markCompleted(Long knowledgeFileId, int embedChunkCount) {
        KnowledgeFile f =
                knowledgeFileRepository
                        .findById(knowledgeFileId)
                        .orElseThrow(
                                () -> new IllegalStateException("knowledge file not found: " + knowledgeFileId));
        f.setStatus(IngestionStatus.COMPLETED);
        f.setEmbedChunkCount(embedChunkCount);
        f.setErrorMessage(null);
        knowledgeFileRepository.save(f);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long knowledgeFileId, String errorMessage) {
        KnowledgeFile f =
                knowledgeFileRepository
                        .findById(knowledgeFileId)
                        .orElseThrow(
                                () -> new IllegalStateException("knowledge file not found: " + knowledgeFileId));
        f.setStatus(IngestionStatus.FAILED);
        f.setErrorMessage(trimErrorMessage(errorMessage));
        knowledgeFileRepository.save(f);
    }

    private static String trimErrorMessage(String message) {
        if (message == null) {
            return null;
        }
        if (message.length() <= MAX_ERROR_LEN) {
            return message;
        }
        return message.substring(0, MAX_ERROR_LEN);
    }
}
