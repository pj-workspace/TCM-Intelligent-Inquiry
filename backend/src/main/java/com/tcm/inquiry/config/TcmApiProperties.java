package com.tcm.inquiry.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 跨环境 API 行为：错误详情暴露、CORS 来源等。
 */
@ConfigurationProperties(prefix = "tcm.api")
public class TcmApiProperties {

    /**
     * 是否在 JSON 错误响应中附带异常原文（生产环境应关闭，仅记录服务端日志）。
     */
    private boolean exposeErrorDetails = true;

    /**
     * CORS {@code allowedOriginPatterns}。为空时回退为 {@code *}；生产请列出明确来源。
     */
    private List<String> corsAllowedOriginPatterns = new ArrayList<>();

    public boolean isExposeErrorDetails() {
        return exposeErrorDetails;
    }

    public void setExposeErrorDetails(boolean exposeErrorDetails) {
        this.exposeErrorDetails = exposeErrorDetails;
    }

    public List<String> getCorsAllowedOriginPatterns() {
        return corsAllowedOriginPatterns;
    }

    public void setCorsAllowedOriginPatterns(List<String> corsAllowedOriginPatterns) {
        this.corsAllowedOriginPatterns = corsAllowedOriginPatterns;
    }
}
