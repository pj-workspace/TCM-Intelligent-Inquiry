package com.tcm.inquiry.modules.consultation.dto;

/**
 * 创建会话请求体；title 可空，由服务层给默认值。
 */
public class CreateSessionRequest {

    private String title;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
