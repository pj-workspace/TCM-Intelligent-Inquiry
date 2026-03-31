package com.tcm.inquiry.modules.agent;

import org.springframework.stereotype.Service;

@Service
public class AgentService {

    /**
     * @param task      任务描述
     * @param imagePath 可选图片路径，可为 null
     */
    public AgentRunResponse runAgent(String task, String imagePath) {
        return new AgentRunResponse("stub");
    }
}
