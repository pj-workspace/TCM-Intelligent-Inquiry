package com.tcm.inquiry.modules.knowledge.dto;

import jakarta.validation.constraints.NotBlank;

public class KnowledgeQueryRequest {

    @NotBlank private String message;

    private Integer topK;
    private Double similarityThreshold;

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    public Double getSimilarityThreshold() {
        return similarityThreshold;
    }

    public void setSimilarityThreshold(Double similarityThreshold) {
        this.similarityThreshold = similarityThreshold;
    }
}
