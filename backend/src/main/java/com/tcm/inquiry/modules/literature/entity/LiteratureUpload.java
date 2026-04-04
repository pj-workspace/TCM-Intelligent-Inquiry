package com.tcm.inquiry.modules.literature.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "literature_uploads")
public class LiteratureUpload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false, length = 64)
    private String tempCollectionId;

    /** 单文件在集合内唯一；仅登记未入库的旧数据可能为空 */
    @Column(name = "file_uuid", length = 64)
    private String fileUuid;

    @Column(name = "stored_relative_path")
    private String storedRelativePath;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "content_type")
    private String contentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private LiteratureUploadStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    /**
     * 文献临时库的统一过期时刻（同一 temp_collection_id 下多行在每次上传后会被批量刷新为相同值）。
     * 定时任务扫描 expires_at &lt; now 的集合并执行与手动删除等价的清理。历史数据为 null 时不参与自动 TTL 清理。
     */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null) {
            status = LiteratureUploadStatus.PENDING;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public String getTempCollectionId() {
        return tempCollectionId;
    }

    public void setTempCollectionId(String tempCollectionId) {
        this.tempCollectionId = tempCollectionId;
    }

    public LiteratureUploadStatus getStatus() {
        return status;
    }

    public void setStatus(LiteratureUploadStatus status) {
        this.status = status;
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

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
