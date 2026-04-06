package com.tcm.inquiry.modules.agent.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** 单例行（id=1）：智能体前台配置，供 Agent 运行与前端编排页读写。 */
@Entity
@Table(name = "agent_app_config")
public class AgentAppConfig {

    public static final long SINGLETON_ID = 1L;

    @Id
    @Column(nullable = false)
    private Long id = SINGLETON_ID;

    @Column(nullable = false, length = 200)
    private String displayName = "中医视觉智能体";

    @Column(columnDefinition = "TEXT")
    private String textSystemPrompt;

    @Column(columnDefinition = "TEXT")
    private String visionSystemPrompt;

    /** 视觉模型名（DashScope VL，如 qwen-vl-max）；为空则使用 {@code tcm.dashscope.vision-model}。 */
    @Column(length = 200)
    private String visionModelName;

    private Long defaultKnowledgeBaseId;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getTextSystemPrompt() {
        return textSystemPrompt;
    }

    public void setTextSystemPrompt(String textSystemPrompt) {
        this.textSystemPrompt = textSystemPrompt;
    }

    public String getVisionSystemPrompt() {
        return visionSystemPrompt;
    }

    public void setVisionSystemPrompt(String visionSystemPrompt) {
        this.visionSystemPrompt = visionSystemPrompt;
    }

    public String getVisionModelName() {
        return visionModelName;
    }

    public void setVisionModelName(String visionModelName) {
        this.visionModelName = visionModelName;
    }

    public Long getDefaultKnowledgeBaseId() {
        return defaultKnowledgeBaseId;
    }

    public void setDefaultKnowledgeBaseId(Long defaultKnowledgeBaseId) {
        this.defaultKnowledgeBaseId = defaultKnowledgeBaseId;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
