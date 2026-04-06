package com.tcm.inquiry.common.sse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 将 claw-code 中「编排进度 / 事件流」概念映射到浏览器 SSE：通过命名事件 {@code phase} 推送阶段
 * （类似终端里 InternalPromptProgressReporter 的 step/phase），供前端与 Braille Spinner 一起展示流水线。
 */
public final class SsePhaseEvents {

    private SsePhaseEvents() {}

    /**
     * @param phase 机器可读阶段键，例如 {@code rag_retrieval}、{@code model_stream}
     * @param label 直接展示给用户的短文案
     */
    public static void sendPhase(SseEmitter emitter, String phase, String label) throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("phase", phase);
        payload.put("label", label);
        emitter.send(SseEmitter.event().name("phase").data(payload));
    }
}
