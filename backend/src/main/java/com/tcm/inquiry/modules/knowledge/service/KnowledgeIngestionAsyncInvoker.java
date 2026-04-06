package com.tcm.inquiry.modules.knowledge.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 独立的 @Async 入口，避免 {@link KnowledgeIngestionService} 自调用导致异步代理不生效。
 */
@Component
public class KnowledgeIngestionAsyncInvoker {

    private final KnowledgeIngestionWorker worker;

    public KnowledgeIngestionAsyncInvoker(KnowledgeIngestionWorker worker) {
        this.worker = worker;
    }

    @Async("ingestionTaskExecutor")
    public void submit(Long knowledgeFileId, Integer chunkSizeOverride, Integer chunkOverlapOverride) {
        worker.executeIngestionJob(knowledgeFileId, chunkSizeOverride, chunkOverlapOverride);
    }
}
