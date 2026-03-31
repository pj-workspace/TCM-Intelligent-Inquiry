package com.tcm.inquiry.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 供 SSE / 异步控制器注入的线程池；全局异步超时见 application.yml（spring.mvc.async.request-timeout）。
 */
@Configuration
public class SseConfig {

    @Bean(name = "sseAsyncExecutor")
    public AsyncTaskExecutor sseAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("sse-");
        executor.initialize();
        return executor;
    }
}
