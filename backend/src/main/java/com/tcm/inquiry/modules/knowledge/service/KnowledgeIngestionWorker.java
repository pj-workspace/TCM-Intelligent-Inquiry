package com.tcm.inquiry.modules.knowledge.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

import org.springframework.ai.document.Document;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tcm.inquiry.modules.knowledge.ai.VectorStoreFilterDeletion;
import com.tcm.inquiry.modules.knowledge.ai.chunking.IngestionDocumentChunker;
import com.tcm.inquiry.modules.knowledge.config.KnowledgeProperties;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeFile;
import com.tcm.inquiry.modules.knowledge.repository.KnowledgeFileRepository;
import com.tcm.inquiry.modules.knowledge.util.KnowledgeFilenameUtil;

/**
 * 在 {@code ingestionTaskExecutor} 线程中执行实际入库（读盘、切分、向量写入），
 * 与 HTTP 线程及 {@link KnowledgeIngestionService#ingest} 的短事务解耦。
 */
@Service
public class KnowledgeIngestionWorker {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeIngestionWorker.class);

    private final KnowledgeFileRepository knowledgeFileRepository;
    private final VectorStore vectorStore;
    private final KnowledgeProperties knowledgeProperties;
    private final VectorStoreFilterDeletion vectorStoreFilterDeletion;
    private final IngestionDocumentChunker ingestionDocumentChunker;
    private final KnowledgeIngestionTxFacade txFacade;

    public KnowledgeIngestionWorker(
            KnowledgeFileRepository knowledgeFileRepository,
            VectorStore vectorStore,
            KnowledgeProperties knowledgeProperties,
            VectorStoreFilterDeletion vectorStoreFilterDeletion,
            IngestionDocumentChunker ingestionDocumentChunker,
            KnowledgeIngestionTxFacade txFacade) {
        this.knowledgeFileRepository = knowledgeFileRepository;
        this.vectorStore = vectorStore;
        this.knowledgeProperties = knowledgeProperties;
        this.vectorStoreFilterDeletion = vectorStoreFilterDeletion;
        this.ingestionDocumentChunker = ingestionDocumentChunker;
        this.txFacade = txFacade;
    }

    public void executeIngestionJob(Long knowledgeFileId, Integer chunkSizeOverride, Integer chunkOverlapOverride) {
        if (!txFacade.markProcessingIfPending(knowledgeFileId)) {
            log.debug("ingestion skipped (not pending or already taken) id={}", knowledgeFileId);
            return;
        }

        KnowledgeFile row =
                knowledgeFileRepository.findByIdWithKnowledgeBase(knowledgeFileId).orElse(null);
        if (row == null) {
            log.warn("ingestion aborted: row missing after transition to PROCESSING id={}", knowledgeFileId);
            return;
        }

        Long knowledgeBaseId = row.getKnowledgeBase().getId();
        String fileUuid = row.getFileUuid();
        Path target = Paths.get(row.getStoredRelativePath()).normalize();
        String safeName = KnowledgeFilenameUtil.sanitize(row.getOriginalFilename());
        String kbIdStr = String.valueOf(knowledgeBaseId);

        int overlapEff =
                chunkOverlapOverride != null
                        ? chunkOverlapOverride
                        : knowledgeProperties.getDefaultChunkOverlapChars();
        int chunk =
                chunkSizeOverride != null && chunkSizeOverride > 32
                        ? chunkSizeOverride
                        : knowledgeProperties.getChunkSize();

        try {
            TikaDocumentReader reader = new TikaDocumentReader(new FileSystemResource(target));
            List<Document> loaded = reader.get();
            if (loaded.isEmpty()) {
                throw new IllegalStateException("no text extracted from file");
            }

            List<Document> chunks =
                    ingestionDocumentChunker.chunk(loaded, chunkSizeOverride, chunkOverlapOverride);
            for (Document d : chunks) {
                d.getMetadata().put("kb_id", kbIdStr);
                d.getMetadata().put("file_id", fileUuid);
                d.getMetadata().put("source", safeName);
            }

            vectorStore.add(chunks);
            txFacade.markCompleted(knowledgeFileId, chunks.size());

            log.info(
                    "知识库入库完成 kbId={} fileRowId={} file={} chunks={} chunkSizeParam={} overlapChars={}",
                    knowledgeBaseId,
                    knowledgeFileId,
                    safeName,
                    chunks.size(),
                    chunk,
                    overlapEff);
        } catch (Throwable t) {
            log.error(
                    "知识库入库失败 kbId={} fileRowId={} uuid={}",
                    knowledgeBaseId,
                    knowledgeFileId,
                    fileUuid,
                    t);
            rollbackVectors(fileUuid);
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
                // best-effort 清理落盘文件，与旧同步实现一致
            }
            String detail =
                    t.getMessage() != null && !t.getMessage().isBlank()
                            ? t.getMessage()
                            : t.getClass().getSimpleName();
            txFacade.markFailed(knowledgeFileId, detail);
        }
    }

    private void rollbackVectors(String fileUuid) {
        try {
            vectorStoreFilterDeletion.deleteByFilter(
                    new FilterExpressionBuilder().eq("file_id", fileUuid).build());
        } catch (Exception ignore) {
            // best-effort：失败路径上向量可能尚未写入或部分写入
        }
    }
}
