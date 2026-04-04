package com.tcm.inquiry.modules.literature.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.tcm.inquiry.modules.literature.entity.LiteratureUpload;

public interface LiteratureUploadRepository extends JpaRepository<LiteratureUpload, Long> {

    List<LiteratureUpload> findByTempCollectionIdOrderByCreatedAtDesc(String tempCollectionId);

    Optional<LiteratureUpload> findByTempCollectionIdAndFileUuid(String tempCollectionId, String fileUuid);

    void deleteByTempCollectionId(String tempCollectionId);

    boolean existsByTempCollectionId(String tempCollectionId);

    /**
     * 将同一临时库下所有登记行的过期时间统一顺延（滑动 TTL）；与本次新入库行的 expiresAt 保持一致。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update LiteratureUpload u set u.expiresAt = :exp where u.tempCollectionId = :cid")
    int bumpExpiresAtForCollection(@Param("cid") String tempCollectionId, @Param("exp") Instant expiresAt);

    /**
     * 找出已过期集合 ID（任一行过期即视为整个临时库到期，因同库各行 expires_at 本应对齐）。
     */
    @Query(
            "select distinct u.tempCollectionId from LiteratureUpload u where u.expiresAt is not null and u.expiresAt < :now")
    List<String> findDistinctExpiredCollectionIds(@Param("now") Instant now);
}
