package com.tcm.inquiry.modules.consultation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 流式问诊请求。temperature / maxHistoryTurns 可选，由服务端设默认值。
 */
public class ConsultationChatRequest {

    @NotNull
    private Long sessionId;

    @NotBlank
    private String message;

    /** 覆盖 Ollama 采样温度；null 时使用服务端默认（如 0.7）。 */
    private Double temperature;

    /**
     * 参与上下文的历史「轮数」，每轮对应一条 {@link com.tcm.inquiry.modules.consultation.entity.ChatMessage}；
     * null 时使用服务端默认（如 10）。
     */
    private Integer maxHistoryTurns;

    public Long getSessionId() {
        return sessionId;
    }

    public void setSessionId(Long sessionId) {
        this.sessionId = sessionId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Integer getMaxHistoryTurns() {
        return maxHistoryTurns;
    }

    public void setMaxHistoryTurns(Integer maxHistoryTurns) {
        this.maxHistoryTurns = maxHistoryTurns;
    }
}
