package com.tcm.inquiry.modules.consultation;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.tcm.inquiry.common.api.ApiResult;
import com.tcm.inquiry.common.api.R;
import com.tcm.inquiry.modules.consultation.dto.ChatMessageView;
import com.tcm.inquiry.modules.consultation.dto.ChatSessionResponse;
import com.tcm.inquiry.modules.consultation.dto.ConsultationChatRequest;
import com.tcm.inquiry.modules.consultation.dto.CreateSessionRequest;
import com.tcm.inquiry.modules.consultation.service.ConsultationChatService;
import com.tcm.inquiry.modules.consultation.service.ConsultationService;

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

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResult<Void>> deleteSession(@PathVariable("sessionId") Long sessionId) {
        consultationService.deleteSession(sessionId);
        return ResponseEntity.ok(R.ok(null));
    }

    /**
     * 纯文本流式问诊：SSE。RAG 时顺序为 {@code event: phase}（检索）→ {@code meta} → {@code phase}（流式生成）→
     * 正文 token；纯问诊为 {@code phase} → token。结束前 {@code [DONE]}，异常时 {@code event: error}。
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody ConsultationChatRequest body) {
        return consultationChatService.streamChat(body);
    }
}
