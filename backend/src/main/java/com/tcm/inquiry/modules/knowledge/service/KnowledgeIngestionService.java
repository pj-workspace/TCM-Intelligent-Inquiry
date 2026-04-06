package com.tcm.inquiry.modules.knowledge.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.tcm.inquiry.modules.knowledge.config.KnowledgeProperties;
import com.tcm.inquiry.modules.knowledge.dto.resp.KnowledgeFileView;
import com.tcm.inquiry.modules.knowledge.entity.IngestionStatus;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeBase;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeFile;
import com.tcm.inquiry.modules.knowledge.repository.KnowledgeBaseRepository;
import com.tcm.inquiry.modules.knowledge.repository.KnowledgeFileRepository;
import com.tcm.inquiry.modules.knowledge.util.KnowledgeFilenameUtil;

/**
 * 知识库上传入口：同步阶段完成校验、落盘与 {@link IngestionStatus#PENDING} 元数据持久化，
 * 提交事务后再调度 {@link KnowledgeIngestionAsyncInvoker}，立即返回待处理视图。
 */
@Service
public class KnowledgeIngestionService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KnowledgeFileRepository knowledgeFileRepository;
    private final KnowledgeProperties knowledgeProperties;
    private final KnowledgeIngestionAsyncInvoker asyncInvoker;

    public KnowledgeIngestionService(
            KnowledgeBaseRepository knowledgeBaseRepository,
            KnowledgeFileRepository knowledgeFileRepository,
            KnowledgeProperties knowledgeProperties,
            KnowledgeIngestionAsyncInvoker asyncInvoker) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.knowledgeFileRepository = knowledgeFileRepository;
        this.knowledgeProperties = knowledgeProperties;
        this.asyncInvoker = asyncInvoker;
    }

    /**
     * 接收上传：写入本地文件 + 保存 PENDING 行，事务提交后异步执行向量化；响应不等待向量写入完成。
     */
    @Transactional
    public KnowledgeFileView ingest(
            Long knowledgeBaseId,
            MultipartFile multipart,
            Integer chunkSizeOverride,
            Integer chunkOverlapOverride)
            throws IOException {
        KnowledgeBase kb =
                knowledgeBaseRepository
                        .findById(knowledgeBaseId)
                        .orElseThrow(() -> new IllegalArgumentException("knowledge base not found: " + knowledgeBaseId));

        if (multipart.isEmpty()) {
            throw new IllegalArgumentException("empty file");
        }

        String fileUuid = UUID.randomUUID().toString();
        String safeName = KnowledgeFilenameUtil.sanitize(multipart.getOriginalFilename());
        String diskName = fileUuid + "_" + safeName;

        Path storageRoot = Paths.get(knowledgeProperties.getStorageDir()).normalize();
        Path kbDir = storageRoot.resolve(knowledgeBaseId.toString());
        Files.createDirectories(kbDir);
        Path target = kbDir.resolve(diskName);
        multipart.transferTo(target);

        String relativeStored =
                storageRoot
                        .resolve(knowledgeBaseId.toString())
                        .resolve(diskName)
                        .toString()
                        .replace('\\', '/');

        KnowledgeFile row = new KnowledgeFile();
        row.setKnowledgeBase(kb);
        row.setOriginalFilename(
                multipart.getOriginalFilename() != null ? multipart.getOriginalFilename() : safeName);
        row.setFileUuid(fileUuid);
        row.setStoredRelativePath(relativeStored);
        row.setContentType(
                multipart.getContentType() != null ? multipart.getContentType() : "application/octet-stream");
        row.setSizeBytes(multipart.getSize());
        row.setEmbedChunkCount(null);
        row.setStatus(IngestionStatus.PENDING);
        row.setErrorMessage(null);
        KnowledgeFile saved = knowledgeFileRepository.save(row);
        Long persistedId = saved.getId();

        scheduleAfterCommit(persistedId, chunkSizeOverride, chunkOverlapOverride);

        return KnowledgeFileView.fromEntity(saved);
    }

    private void scheduleAfterCommit(Long knowledgeFileId, Integer chunkSizeOverride, Integer chunkOverlapOverride) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            asyncInvoker.submit(knowledgeFileId, chunkSizeOverride, chunkOverlapOverride);
                        }
                    });
        } else {
            asyncInvoker.submit(knowledgeFileId, chunkSizeOverride, chunkOverlapOverride);
        }
    }
}
