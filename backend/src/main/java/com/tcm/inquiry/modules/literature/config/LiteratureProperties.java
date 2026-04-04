package com.tcm.inquiry.modules.literature.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tcm.literature")
public class LiteratureProperties {

    /** 文献文件落盘目录（相对 backend 工作目录） */
    private String storageDir = "data/literature-files";

    /**
     * 临时文献向量与元数据在「无新上传」情况下的保留时长；每次向同一 collection 上传新文件时，会整库顺延该时间
     * （滑动窗口），贴近「会话持续则资源延续」的产品预期。
     */
    private int vectorTtlHours = 24;

    /** 是否注册定时任务，扫描过期文献库并删除 MySQL 行、磁盘文件与 Redis 向量 */
    private boolean cleanupEnabled = true;

    /** 过期扫描间隔（毫秒），默认 5 分钟 */
    private long cleanupFixedDelayMs = 300_000L;

    public String getStorageDir() {
        return storageDir;
    }

    public void setStorageDir(String storageDir) {
        this.storageDir = storageDir;
    }

    public int getVectorTtlHours() {
        return vectorTtlHours;
    }

    public void setVectorTtlHours(int vectorTtlHours) {
        this.vectorTtlHours = vectorTtlHours;
    }

    public boolean isCleanupEnabled() {
        return cleanupEnabled;
    }

    public void setCleanupEnabled(boolean cleanupEnabled) {
        this.cleanupEnabled = cleanupEnabled;
    }

    public long getCleanupFixedDelayMs() {
        return cleanupFixedDelayMs;
    }

    public void setCleanupFixedDelayMs(long cleanupFixedDelayMs) {
        this.cleanupFixedDelayMs = cleanupFixedDelayMs;
    }
}
