package com.tcm.inquiry.common.sse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 将 claw-code 中「编排进度 / 事件流」概念映射到浏览器 SSE：命名事件 {@code phase}，
 * 可带 {@code step}、{@code detail}（类似 CLI InternalPromptProgressReporter 的分步与附注）。
 */
public final class SsePhaseEvents {

    private SsePhaseEvents() {}

    /**
     * @param phase 机器可读阶段键，例如 {@code context_prepare}、{@code agent_orchestration}
     * @param label 直接展示给用户的短文案
     */
    public static void sendPhase(SseEmitter emitter, String phase, String label) throws IOException {
        sendPhase(emitter, phase, label, null, null);
    }

    /**
     * @param detail 可选附注（工具上下文、心跳说明等）
     * @param step 可选步骤序号（从 1 起），便于前端画时间线
     */
    public static void sendPhase(
            SseEmitter emitter, String phase, String label, String detail, Integer step)
            throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phase", phase);
        payload.put("label", label);
        if (detail != null && !detail.isBlank()) {
            payload.put("detail", detail.trim());
        }
        if (step != null) {
            payload.put("step", step);
        }
        emitter.send(SseEmitter.event().name("phase").data(payload));
    }
}
