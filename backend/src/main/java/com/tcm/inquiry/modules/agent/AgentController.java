package com.tcm.inquiry.modules.agent;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tcm.inquiry.common.ApiResult;
import com.tcm.inquiry.common.R;

import jakarta.validation.Valid;

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

    @PostMapping(value = "/run", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResult<AgentRunResponse>> runJson(@Valid @RequestBody AgentRunRequest body) {
        return ResponseEntity.ok(R.ok(agentService.runJson(body)));
    }

    @PostMapping(value = "/run", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResult<AgentRunResponse>> runMultipart(
            @RequestParam("task") String task,
            @RequestParam(value = "knowledgeBaseId", required = false) Long knowledgeBaseId,
            @RequestParam(value = "ragTopK", required = false) Integer ragTopK,
            @RequestParam(value = "ragSimilarityThreshold", required = false) Double ragSimilarityThreshold,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(
                R.ok(
                        agentService.runMultipart(
                                task, knowledgeBaseId, ragTopK, ragSimilarityThreshold, image)));
    }

    @GetMapping({"", "/"})
    public ResponseEntity<ApiResult<Map<String, String>>> moduleInfo() {
        return ResponseEntity.ok(
                R.ok(
                        Map.of(
                                "module", "agent",
                                "health", "/api/v1/agent/health")));
    }
}
