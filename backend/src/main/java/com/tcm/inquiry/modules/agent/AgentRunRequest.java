package com.tcm.inquiry.modules.agent;

/**
 * POST /api/v1/agent/run 请求体。{@code imagePath} 可为 null（JSON 中可省略）。
 */
public record AgentRunRequest(String task, String imagePath) {
}
