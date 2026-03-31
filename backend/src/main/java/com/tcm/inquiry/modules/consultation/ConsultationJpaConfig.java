package com.tcm.inquiry.modules.consultation;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import com.tcm.inquiry.modules.consultation.entity.ChatSession;
import com.tcm.inquiry.modules.consultation.repository.ChatSessionRepository;

/**
 * 将咨询模块实体与仓库纳入 JPA 扫描（与 infrastructure 中的扫描并存）。
 */
@Configuration
@EntityScan(basePackageClasses = ChatSession.class)
@EnableJpaRepositories(basePackageClasses = ChatSessionRepository.class)
public class ConsultationJpaConfig {
}
