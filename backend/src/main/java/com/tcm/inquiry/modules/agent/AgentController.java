package com.tcm.inquiry.modules.agent;

import com.tcm.inquiry.common.ApiResult;
import com.tcm.inquiry.common.R;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {

    private final AgentService agentService;

    public AgentController(AgentService agentService) {
        this.agentService = agentService;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResult<String>> health() {
        return ResponseEntity.ok(R.ok("agent"));
    }

    @PostMapping("/run")
    public ResponseEntity<ApiResult<AgentRunResponse>> run(@RequestBody AgentRunRequest body) {
        AgentRunResponse data = agentService.runAgent(body.task(), body.imagePath());
        return ResponseEntity.ok(R.ok(data));
    }

    @GetMapping({"", "/"})
    public ResponseEntity<ApiResult<Void>> stub() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(R.notImplemented());
    }
}
