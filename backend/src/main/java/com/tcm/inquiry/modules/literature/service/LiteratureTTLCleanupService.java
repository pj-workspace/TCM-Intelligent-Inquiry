package com.tcm.inquiry.modules.literature.service;

import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.tcm.inquiry.modules.literature.repository.LiteratureUploadRepository;

/**
 * 模块三临时文献库生命周期：按 MySQL 中 {@code expires_at} 触发整库清理，删除 Redis-Stack 中
 * {@code lit_collection_id} 对应向量与本地落盘文件，释放隐私与索引空间。
 */
@Service
@ConditionalOnProperty(
        prefix = "tcm.literature",
        name = "cleanup-enabled",
        havingValue = "true",
        matchIfMissing = true)
public class LiteratureTTLCleanupService {

    private static final Logger log = LoggerFactory.getLogger(LiteratureTTLCleanupService.class);

    private final LiteratureUploadRepository literatureUploadRepository;
    private final LiteratureManageService literatureManageService;

    public LiteratureTTLCleanupService(
            LiteratureUploadRepository literatureUploadRepository,
            LiteratureManageService literatureManageService) {
        this.literatureUploadRepository = literatureUploadRepository;
        this.literatureManageService = literatureManageService;
    }

    /**
     * 固定延迟调度：避免与请求线程争抢，单线程顺序 purge；间隔可由配置覆盖。
     */
    @Scheduled(fixedDelayString = "${tcm.literature.cleanup-fixed-delay-ms:300000}")
    public void purgeExpiredCollections() {
        Instant now = Instant.now();
        try {
            List<String> ids = literatureUploadRepository.findDistinctExpiredCollectionIds(now);
            if (ids.isEmpty()) {
                return;
            }
            log.info("文献临时库 TTL 清理：发现 {} 个过期 collection，开始删除", ids.size());
            for (String collectionId : ids) {
                try {
                    literatureManageService.deleteCollection(collectionId);
                    log.info("已清理过期文献库 collectionId={}", collectionId);
                } catch (Exception ex) {
                    log.warn("清理文献库失败 collectionId={}，下一周期重试", collectionId, ex);
                }
            }
        } catch (Exception ex) {
            log.error("文献 TTL 扫描任务异常", ex);
        }
    }
}
