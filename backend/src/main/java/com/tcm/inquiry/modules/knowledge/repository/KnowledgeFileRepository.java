package com.tcm.inquiry.modules.knowledge.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.tcm.inquiry.modules.knowledge.entity.IngestionStatus;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeFile;

public interface KnowledgeFileRepository extends JpaRepository<KnowledgeFile, Long> {

    List<KnowledgeFile> findByKnowledgeBase_IdOrderByCreatedAtDesc(Long knowledgeBaseId);

    Optional<KnowledgeFile> findByKnowledgeBase_IdAndFileUuid(Long knowledgeBaseId, String fileUuid);

    @Query(
            "select distinct f from KnowledgeFile f join fetch f.knowledgeBase where f.id = :id")
    Optional<KnowledgeFile> findByIdWithKnowledgeBase(@Param("id") Long id);

    /**
     * 条件更新入库状态，用于异步任务抢占 PENDING → PROCESSING，避免重复执行。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            "update KnowledgeFile f set f.status = :newStatus, f.errorMessage = :err where f.id = :id"
                    + " and f.status = :expected")
    int updateIngestionStatusWhere(
            @Param("id") Long id,
            @Param("expected") IngestionStatus expected,
            @Param("newStatus") IngestionStatus newStatus,
            @Param("err") String errorMessage);
}
