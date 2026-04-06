package com.tcm.inquiry.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.model.tool.DefaultToolExecutionEligibilityPredicate;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionEligibilityPredicate;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.support.RetryTemplate;

import io.micrometer.observation.ObservationRegistry;

/**
 * 在 Spring AI OpenAI 协议自动配置的 {@link OpenAiApi} 之上，额外注册多模态视觉模型 Bean（千问 VL），
 * 供药材识图工具与 multipart 视觉路径使用。
 */
@Configuration
public class AiConfig {

    public static final String VISION_CHAT_MODEL = "visionChatModel";

    @Bean(name = VISION_CHAT_MODEL)
    public ChatModel visionChatModel(
            OpenAiApi openAiApi,
            ToolCallingManager toolCallingManager,
            RetryTemplate retryTemplate,
            ObjectProvider<ObservationRegistry> observationRegistry,
            ObjectProvider<ToolExecutionEligibilityPredicate> toolExecutionEligibilityPredicate,
            @Value("${tcm.dashscope.vision-model:qwen-vl-max}") String visionModel) {

        return OpenAiChatModel.builder()
                .openAiApi(openAiApi)
                .defaultOptions(OpenAiChatOptions.builder().model(visionModel).build())
                .toolCallingManager(toolCallingManager)
                .toolExecutionEligibilityPredicate(
                        toolExecutionEligibilityPredicate.getIfUnique(
                                DefaultToolExecutionEligibilityPredicate::new))
                .retryTemplate(retryTemplate)
                .observationRegistry(observationRegistry.getIfUnique(() -> ObservationRegistry.NOOP))
                .build();
    }
}
