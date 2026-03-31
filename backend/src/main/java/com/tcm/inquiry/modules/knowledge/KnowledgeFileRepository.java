package com.tcm.inquiry.modules.knowledge;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeFileRepository extends JpaRepository<KnowledgeFile, Long> {

    List<KnowledgeFile> findByKnowledgeBase_IdOrderByCreatedAtDesc(Long knowledgeBaseId);

    Optional<KnowledgeFile> findByKnowledgeBase_IdAndFileUuid(Long knowledgeBaseId, String fileUuid);
}
