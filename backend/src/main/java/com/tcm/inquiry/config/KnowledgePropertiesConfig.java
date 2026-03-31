package com.tcm.inquiry.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import com.tcm.inquiry.modules.knowledge.KnowledgeProperties;

@Configuration
@EnableConfigurationProperties(KnowledgeProperties.class)
public class KnowledgePropertiesConfig {}
