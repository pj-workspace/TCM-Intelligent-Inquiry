package com.tcm.inquiry.infrastructure.vectorstore;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * 单元测试与 ci 场景：不依赖 Redis Stack，使用内存向量库，避免流水线与本机单测因中间件未启动而失败。
 * <p>正式部署请勿激活 {@code test} / {@code ci} profile，应使用 {@link RedisStackVectorStoreConfig}。</p>
 */
@Configuration
@Profile({"test", "ci"})
public class SimpleVectorStoreFallbackConfig {

    @Bean
    public VectorStore vectorStore(EmbeddingModel embeddingModel) {
        return SimpleVectorStore.builder(embeddingModel).build();
    }
}
