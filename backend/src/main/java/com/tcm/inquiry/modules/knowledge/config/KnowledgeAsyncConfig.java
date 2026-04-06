package com.tcm.inquiry.modules.knowledge.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 知识库异步入库线程池。
 * <p>与前端并发上传对齐：允许多个 HTTP 请求同时提交任务，由有限线程池串起 CPU/IO 与向量写入。
 * <p>池大小刻意保守（2～4）：embedding / 向量服务常有 QPS 与并发配额限制，过大易触发远端 429 或排队超时。
 */
@Configuration
@EnableAsync
public class KnowledgeAsyncConfig {

    @Bean(name = "ingestionTaskExecutor")
    public Executor ingestionTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(256);
        executor.setThreadNamePrefix("kb-ingest-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(90);
        executor.initialize();
        return executor;
    }
}
