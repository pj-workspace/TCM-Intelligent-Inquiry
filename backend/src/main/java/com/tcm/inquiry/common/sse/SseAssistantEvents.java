package com.tcm.inquiry.common.sse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * claw-code / Anthropic 风格助手侧流式事件：通过命名事件 {@code assistant} 与 JSON 内 {@code type}
 * 区分正文增量（{@code text_delta}）与后续可扩展的 {@code message_stop} 等。
 */
public final class SseAssistantEvents {

    private SseAssistantEvents() {}

    /** 与 claw-code {@code ContentBlockDelta} 中 {@code text_delta} 语义对齐。 */
    public static void sendTextDelta(SseEmitter emitter, String text) throws IOException {
        if (text == null || text.isEmpty()) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "text_delta");
        payload.put("text", text);
        emitter.send(SseEmitter.event().name("assistant").data(payload));
    }
}
