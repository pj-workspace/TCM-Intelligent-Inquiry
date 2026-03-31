package com.tcm.inquiry.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 主对话模型与嵌入模型由 Spring AI Ollama 自动配置（application.yml）。
 * 此处额外注册视觉对话模型（与默认 {@link ChatModel} 共用同一 {@link OllamaApi}）。
 */
@Configuration
public class AiConfig {

    public static final String VISION_CHAT_MODEL = "visionChatModel";

    @Bean(name = VISION_CHAT_MODEL)
    public ChatModel visionChatModel(OllamaApi ollamaApi) {
        return OllamaChatModel.builder()
                .ollamaApi(ollamaApi)
                .defaultOptions(OllamaOptions.builder().model("qwen3-vl:2b").build())
                .build();
    }
}
