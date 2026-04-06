package com.tcm.inquiry.modules.knowledge.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "knowledge_files")
public class KnowledgeFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "knowledge_base_id", nullable = false)
    private KnowledgeBase knowledgeBase;

    @Column(nullable = false, length = 512)
    private String originalFilename;

    @Column(nullable = false, unique = true, length = 64)
    private String fileUuid;

    /** data/kb-files 下相对路径（便于备份与审计）。 */
    @Column(nullable = false, length = 1024)
    private String storedRelativePath;

    @Column(length = 128)
    private String contentType;

    private long sizeBytes;

    /**
     * 本次入库写入向量库的 Document 条数（= TokenTextSplitter 切分后的块数）。
     * 用于管理端展示「已向量化」规模；历史数据在加字段前可能为 null。
     */
    @Column(name = "embed_chunk_count")
    private Integer embedChunkCount;

    /**
     * 入库状态；历史行在加列前可能为 null，对外应视为 {@link IngestionStatus#COMPLETED}。
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "ingestion_status", length = 32)
    private IngestionStatus status;

    /** 失败时的可读原因（成功或非失败状态时应为 null）。 */
    @Column(name = "ingestion_error", length = 4000)
    private String errorMessage;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public KnowledgeBase getKnowledgeBase() {
        return knowledgeBase;
    }

    public void setKnowledgeBase(KnowledgeBase knowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public String getFileUuid() {
        return fileUuid;
    }

    public void setFileUuid(String fileUuid) {
        this.fileUuid = fileUuid;
    }

    public String getStoredRelativePath() {
        return storedRelativePath;
    }

    public void setStoredRelativePath(String storedRelativePath) {
        this.storedRelativePath = storedRelativePath;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public Integer getEmbedChunkCount() {
        return embedChunkCount;
    }

    public void setEmbedChunkCount(Integer embedChunkCount) {
        this.embedChunkCount = embedChunkCount;
    }

    public IngestionStatus getStatus() {
        return status;
    }

    public void setStatus(IngestionStatus status) {
        this.status = status;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
