package com.tcm.inquiry.modules.consultation;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.tcm.inquiry.modules.consultation.dto.ConsultationChatRequest;
import com.tcm.inquiry.modules.consultation.entity.ChatMessage;
import com.tcm.inquiry.modules.consultation.repository.ChatMessageRepository;
import com.tcm.inquiry.modules.consultation.repository.ChatSessionRepository;

import reactor.core.scheduler.Schedulers;

@Service
public class ConsultationChatService {

    private static final Logger log = LoggerFactory.getLogger(ConsultationChatService.class);

    private static final double DEFAULT_TEMPERATURE = 0.7;
    private static final int DEFAULT_MAX_HISTORY_TURNS = 10;

    private final ChatModel chatModel;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ConsultationMessageStore consultationMessageStore;
    private final Executor sseAsyncExecutor;

    @Value("${spring.ai.ollama.chat.options.model:deepseek-r1:8b}")
    private String defaultChatModelName;

    public ConsultationChatService(
            @Qualifier("ollamaChatModel") ChatModel chatModel,
            ChatSessionRepository chatSessionRepository,
            ChatMessageRepository chatMessageRepository,
            ConsultationMessageStore consultationMessageStore,
            @Qualifier("sseAsyncExecutor") Executor sseAsyncExecutor) {
        this.chatModel = chatModel;
        this.chatSessionRepository = chatSessionRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.consultationMessageStore = consultationMessageStore;
        this.sseAsyncExecutor = sseAsyncExecutor;
    }

    /**
     * 建立 SSE：拉历史 → 流式调用 Ollama → 结束后异步落库。
     */
    public SseEmitter streamChat(ConsultationChatRequest req) {
        if (!chatSessionRepository.existsById(req.getSessionId())) {
            throw new IllegalArgumentException("session not found: " + req.getSessionId());
        }

        SseEmitter emitter = new SseEmitter(600_000L);
        double temperature =
                req.getTemperature() != null ? req.getTemperature() : DEFAULT_TEMPERATURE;
        int maxTurns =
                req.getMaxHistoryTurns() != null
                        ? Math.max(1, req.getMaxHistoryTurns())
                        : DEFAULT_MAX_HISTORY_TURNS;

        List<Message> historyMessages = buildHistoryMessages(req.getSessionId(), maxTurns);
        String userInput = req.getMessage().trim();

        ChatClient chatClient =
                ChatClient.builder(chatModel).defaultSystem(ConsultationPrompts.SYSTEM).build();

        var streamSpec =
                chatClient
                        .prompt()
                        .options(
                                OllamaOptions.builder()
                                        .temperature(temperature)
                                        .build())
                        .messages(historyMessages)
                        .user(userInput)
                        .stream();

        StringBuilder assistantAcc = new StringBuilder();
        AtomicReference<Throwable> errorRef = new AtomicReference<>();

        sseAsyncExecutor.execute(
                () ->
                        streamSpec
                                .content()
                                .subscribeOn(Schedulers.boundedElastic())
                                .doOnNext(
                                        token -> {
                                            assistantAcc.append(token);
                                            try {
                                                emitter.send(SseEmitter.event().data(token));
                                            } catch (IOException e) {
                                                errorRef.compareAndSet(null, e);
                                                emitter.completeWithError(e);
                                            }
                                        })
                                .doOnError(
                                        ex -> {
                                            log.warn("consultation stream error", ex);
                                            errorRef.compareAndSet(null, ex);
                                            try {
                                                emitter.send(
                                                        SseEmitter.event()
                                                                .name("error")
                                                                .data(
                                                                        ex.getMessage() != null
                                                                                ? ex.getMessage()
                                                                                : "stream error"));
                                            } catch (IOException ignored) {
                                                // ignore
                                            }
                                            emitter.completeWithError(ex);
                                        })
                                .doOnComplete(
                                        () -> {
                                            if (errorRef.get() != null) {
                                                return;
                                            }
                                            try {
                                                emitter.send(SseEmitter.event().data("[DONE]"));
                                            } catch (IOException e) {
                                                emitter.completeWithError(e);
                                                return;
                                            }
                                            emitter.complete();
                                            String fullReply = assistantAcc.toString();
                                            sseAsyncExecutor.execute(
                                                    () -> {
                                                        try {
                                                            consultationMessageStore.saveTurn(
                                                                    req.getSessionId(),
                                                                    userInput,
                                                                    fullReply,
                                                                    defaultChatModelName,
                                                                    temperature);
                                                        } catch (Exception ex) {
                                                            log.error(
                                                                    "Failed to persist consultation turn sessionId={}",
                                                                    req.getSessionId(),
                                                                    ex);
                                                        }
                                                    });
                                        })
                                .subscribe());

        emitter.onTimeout(
                () -> {
                    log.warn("SSE timeout sessionId={}", req.getSessionId());
                    emitter.complete();
                });
        emitter.onCompletion(() -> log.debug("SSE completed sessionId={}", req.getSessionId()));

        return emitter;
    }

    private List<Message> buildHistoryMessages(Long sessionId, int maxTurns) {
        List<ChatMessage> rows = chatMessageRepository.findBySession_IdOrderByIdAsc(sessionId);
        if (rows.size() > maxTurns) {
            rows = rows.subList(rows.size() - maxTurns, rows.size());
        }
        List<Message> messages = new ArrayList<>(rows.size() * 2);
        for (ChatMessage row : rows) {
            messages.add(new UserMessage(row.getUserMessage()));
            messages.add(new AssistantMessage(row.getAssistantMessage()));
        }
        return messages;
    }
}
