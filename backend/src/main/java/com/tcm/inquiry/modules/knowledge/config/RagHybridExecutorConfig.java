package com.tcm.inquiry.modules.knowledge.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 混合检索并行执行器：语义向量与 Redis 全文两路并行，限制池大小以避免压垮 embedding 与 Redis。
 */
@Configuration
public class RagHybridExecutorConfig {

    public static final String RAG_HYBRID_EXECUTOR = "ragHybridExecutor";

    @Bean(name = RAG_HYBRID_EXECUTOR)
    public Executor ragHybridExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("rag-hybrid-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
