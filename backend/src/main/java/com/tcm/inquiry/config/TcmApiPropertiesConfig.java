package com.tcm.inquiry.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TcmApiProperties.class)
public class TcmApiPropertiesConfig {}
