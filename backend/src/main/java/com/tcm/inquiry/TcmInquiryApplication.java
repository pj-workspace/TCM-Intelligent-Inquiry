package com.tcm.inquiry;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.ai.vectorstore.redis.autoconfigure.RedisVectorStoreAutoConfiguration;

import com.tcm.inquiry.bootstrap.DotEnvLoader;

/**
 * 中医智能问诊后端入口。
 * <p>排除 {@link RedisVectorStoreAutoConfiguration}：向量库由 {@code RedisStackVectorStoreConfig} 显式装配 metadata 字段，
 * 避免与默认自动配置重复注册 {@link org.springframework.ai.vectorstore.VectorStore} Bean。</p>
 */
@SpringBootApplication(exclude = {RedisVectorStoreAutoConfiguration.class})
@EnableScheduling
public class TcmInquiryApplication {

    public static void main(String[] args) {
        DotEnvLoader.loadOptionalProjectDotEnv();
        ensureLocalStorageDirectories();
        SpringApplication.run(TcmInquiryApplication.class, args);
    }

    /**
     * 知识库 / 文献原始文件落盘目录（见 application.yml 中 tcm.knowledge.storage-dir 等），启动前创建以免首写失败。
     */
    private static void ensureLocalStorageDirectories() {
        try {
            Files.createDirectories(Path.of("data"));
            Files.createDirectories(Path.of("data", "kb-files"));
            Files.createDirectories(Path.of("data", "literature-files"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
