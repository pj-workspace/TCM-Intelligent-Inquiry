package com.tcm.inquiry.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.tcm.inquiry.config.AiConfig;

/**
 * 需有效 {@code DASHSCOPE_API_KEY} 与网络。未设置 {@code DASHSCOPE_LIVE=true} 时整类跳过。
 */
@SpringBootTest
@ActiveProfiles("ci")
@EnabledIfEnvironmentVariable(named = "DASHSCOPE_LIVE", matches = "true")
class DashScopeLiveIntegrationTest {

    @Autowired
    @Qualifier("openAiChatModel")
    private ChatModel textChatModel;

    @Autowired private EmbeddingModel embeddingModel;

    @Autowired
    @Qualifier(AiConfig.VISION_CHAT_MODEL)
    private ChatModel visionChatModel;

    @Test
    void chatModelReturnsNonEmptyAnswer() {
        String reply =
                ChatClient.builder(textChatModel)
                        .build()
                        .prompt()
                        .user("用不超过五个字回复：你好")
                        .call()
                        .content();
        assertThat(reply).isNotBlank();
    }

    @Test
    void embeddingModelProducesVector() {
        float[] v = embeddingModel.embed("中医");
        assertThat(v.length).isGreaterThan(0);
    }

    @Test
    void visionChatModelBeanLoads() {
        assertThat(visionChatModel).isNotNull();
    }
}
