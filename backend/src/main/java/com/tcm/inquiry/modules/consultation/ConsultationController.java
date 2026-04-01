package com.tcm.inquiry.modules.consultation;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.tcm.inquiry.common.ApiResult;
import com.tcm.inquiry.common.R;
import com.tcm.inquiry.modules.consultation.dto.ChatMessageView;
import com.tcm.inquiry.modules.consultation.dto.ChatSessionResponse;
import com.tcm.inquiry.modules.consultation.dto.ConsultationChatRequest;
import com.tcm.inquiry.modules.consultation.dto.CreateSessionRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/consultation")
public class ConsultationController {

    private final ConsultationService consultationService;
    private final ConsultationChatService consultationChatService;

    public ConsultationController(
            ConsultationService consultationService, ConsultationChatService consultationChatService) {
        this.consultationService = consultationService;
        this.consultationChatService = consultationChatService;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResult<String>> health() {
        return ResponseEntity.ok(R.ok("consultation"));
    }

    @GetMapping({"", "/"})
    public ResponseEntity<ApiResult<Map<String, String>>> moduleInfo() {
        return ResponseEntity.ok(
                R.ok(
                        Map.of(
                                "module", "consultation",
                                "health", "/api/v1/consultation/health")));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResult<List<ChatSessionResponse>>> listSessions() {
        return ResponseEntity.ok(R.ok(consultationService.listSessions()));
    }

    @PostMapping("/sessions")
    public ResponseEntity<ApiResult<ChatSessionResponse>> createSession(
            @RequestBody(required = false) CreateSessionRequest body) {
        String title = body != null ? body.getTitle() : null;
        return ResponseEntity.ok(R.ok(consultationService.createSession(title)));
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<ApiResult<List<ChatMessageView>>> listMessages(
            @PathVariable("sessionId") Long sessionId) {
        return ResponseEntity.ok(R.ok(consultationService.listMessages(sessionId)));
    }

    /**
     * 纯文本流式问诊：SSE，每条事件 data 为模型增量文本；结束前发送 data: [DONE]。错误时可能收到 event: error。
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody ConsultationChatRequest body) {
        return consultationChatService.streamChat(body);
    }
}
