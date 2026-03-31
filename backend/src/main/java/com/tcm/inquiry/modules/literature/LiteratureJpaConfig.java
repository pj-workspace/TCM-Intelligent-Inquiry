package com.tcm.inquiry.modules.literature;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EntityScan(basePackageClasses = LiteratureUpload.class)
@EnableJpaRepositories(basePackageClasses = LiteratureUploadRepository.class)
public class LiteratureJpaConfig {}
