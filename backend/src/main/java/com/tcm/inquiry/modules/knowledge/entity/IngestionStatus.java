package com.tcm.inquiry.modules.knowledge.entity;

/**
 * 知识库文档向量化（入库）流水线状态，与异步 {@code ingestionTaskExecutor} 任务对齐。
 */
public enum IngestionStatus {
    /** 已落盘并写入元数据，等待后台任务处理 */
    PENDING,
    /** 正在读取、切分并向量写入 */
    PROCESSING,
    /** 处理成功 */
    COMPLETED,
    /** 处理失败（详见 {@link KnowledgeFile#getErrorMessage()}） */
    FAILED
}
