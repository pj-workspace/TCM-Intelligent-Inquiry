package com.tcm.inquiry.infrastructure.entity;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * 显式限定实体与仓库扫描范围（当前可无实体类，占位便于后续扩展）。
 */
@Configuration
@EntityScan(basePackageClasses = JpaInfrastructureConfig.class)
@EnableJpaRepositories(basePackageClasses = JpaInfrastructureConfig.class)
public class JpaInfrastructureConfig {
}
