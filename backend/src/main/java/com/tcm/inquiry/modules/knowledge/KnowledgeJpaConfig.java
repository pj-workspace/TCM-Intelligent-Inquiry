package com.tcm.inquiry.modules.knowledge;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EntityScan(basePackageClasses = {KnowledgeBase.class, KnowledgeFile.class})
@EnableJpaRepositories(
        basePackageClasses = {KnowledgeBaseRepository.class, KnowledgeFileRepository.class})
public class KnowledgeJpaConfig {
}
