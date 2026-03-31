package com.tcm.inquiry.modules.consultation.dto;

import java.time.Instant;

/** 会话中单轮问答（用户句 + 助手完整回复）的只读视图。 */
public record ChatMessageView(
        Long id,
        String userMessage,
        String assistantMessage,
        String modelName,
        Double temperature,
        Instant createdAt) {}
