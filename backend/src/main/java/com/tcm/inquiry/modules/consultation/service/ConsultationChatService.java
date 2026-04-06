package com.tcm.inquiry.modules.consultation.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

import com.tcm.inquiry.common.sse.SsePhaseEvents;
import com.tcm.inquiry.config.TcmApiProperties;
import com.tcm.inquiry.modules.consultation.ai.ConsultationPrompts;
import com.tcm.inquiry.modules.consultation.dto.ConsultationChatRequest;
import com.tcm.inquiry.modules.consultation.entity.ChatMessage;
import com.tcm.inquiry.modules.consultation.repository.ChatMessageRepository;
import com.tcm.inquiry.modules.consultation.repository.ChatSessionRepository;
import com.tcm.inquiry.modules.knowledge.ai.KnowledgeContextBundle;
import com.tcm.inquiry.modules.knowledge.ai.KnowledgeRagService;
import com.tcm.inquiry.modules.literature.ai.LiteratureRagService;

import reactor.core.scheduler.Schedulers;

@Service
public class ConsultationChatService {

    private static final Logger log = LoggerFactory.getLogger(ConsultationChatService.class);

    private static final double DEFAULT_TEMPERATURE = 0.7;
    /** Ollama 常用默认 top_p，与官方示例一致；客户端未传时使用。 */
    private static final double DEFAULT_TOP_P = 0.9;
    private static final int DEFAULT_MAX_HISTORY_TURNS = 10;

    private final ChatModel chatModel;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ConsultationMessageStore consultationMessageStore;
    private final Executor sseAsyncExecutor;
    private final TcmApiProperties apiProperties;
    private final KnowledgeRagService knowledgeRagService;
    private final LiteratureRagService literatureRagService;

    /**
     * 默认对话模型：与 {@code application.yml} 中 {@code spring.ai.ollama.chat.options.model} 对齐，
     * 便于在代码侧组装 {@link OllamaOptions#builder()} 时使用与全局 Bean 一致的模型名；
     * 实际部署前请在 Ollama 中执行 {@code ollama pull} 确保本地已存在该 Tag。
     */
    @Value("${spring.ai.ollama.chat.options.model:gemma4:e2b}")
    private String defaultChatModelName;

    public ConsultationChatService(
            @Qualifier("ollamaChatModel") ChatModel chatModel,
            ChatSessionRepository chatSessionRepository,
            ChatMessageRepository chatMessageRepository,
            ConsultationMessageStore consultationMessageStore,
            @Qualifier("sseAsyncExecutor") Executor sseAsyncExecutor,
            TcmApiProperties apiProperties,
            KnowledgeRagService knowledgeRagService,
            LiteratureRagService literatureRagService) {
        this.chatModel = chatModel;
        this.chatSessionRepository = chatSessionRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.consultationMessageStore = consultationMessageStore;
        this.sseAsyncExecutor = sseAsyncExecutor;
        this.apiProperties = apiProperties;
        this.knowledgeRagService = knowledgeRagService;
        this.literatureRagService = literatureRagService;
    }

    /**
     * 建立 SSE 流水线（对齐 claw-code「事件化编排」思路）：
     * <ul>
     *   <li>立即返回 {@link SseEmitter}，检索与生成均在异步线程中执行，首包即可为 {@code event: phase}；
     *   <li>RAG 场景：{@code phase: rag_retrieval} → 向量检索 → {@code event: meta} → {@code phase: model_stream}
     *       → token 增量 → {@code [DONE]}；
     *   <li>纯问诊：{@code phase: model_stream} → 流式正文。
     * </ul>
     */
    public SseEmitter streamChat(ConsultationChatRequest req) {
        if (!chatSessionRepository.existsById(req.getSessionId())) {
            throw new IllegalArgumentException("session not found: " + req.getSessionId());
        }

        double temperature =
                req.getTemperature() != null ? req.getTemperature() : DEFAULT_TEMPERATURE;
        // 解析 top_p：显式传入则约束在 (0,1]，避免 Ollama 拒参或异常采样行为
        double topP =
                req.getTopP() != null
                        ? Math.min(1.0, Math.max(1e-6, req.getTopP()))
                        : DEFAULT_TOP_P;
        int maxTurns =
                req.getMaxHistoryTurns() != null
                        ? Math.max(1, req.getMaxHistoryTurns())
                        : DEFAULT_MAX_HISTORY_TURNS;

        List<Message> historyMessages = buildHistoryMessages(req.getSessionId(), maxTurns);
        String userInput = req.getMessage().trim();
        String litRaw = req.getLiteratureCollectionId();
        boolean hasLiterature = litRaw != null && !litRaw.isBlank();
        if (req.getKnowledgeBaseId() != null && hasLiterature) {
            throw new IllegalArgumentException("不能同时挂载知识库与文献库");
        }

        SseEmitter emitter = new SseEmitter(600_000L);
        sseAsyncExecutor.execute(
                () ->
                        runConsultationStreamPipeline(
                                emitter,
                                req,
                                historyMessages,
                                userInput,
                                litRaw,
                                hasLiterature,
                                temperature,
                                topP));

        emitter.onTimeout(
                () -> {
                    log.warn("SSE timeout sessionId={}", req.getSessionId());
                    emitter.complete();
                });
        emitter.onCompletion(() -> log.debug("SSE completed sessionId={}", req.getSessionId()));

        return emitter;
    }

    /**
     * 异步执行 RAG（如有）与大模型流式段；任一步失败则 {@code event: error} 并 completeWithError。
     */
    private void runConsultationStreamPipeline(
            SseEmitter emitter,
            ConsultationChatRequest req,
            List<Message> historyMessages,
            String userInput,
            String litRaw,
            boolean hasLiterature,
            double temperature,
            double topP) {
        try {
            String modelUserInput;
            if (req.getKnowledgeBaseId() != null) {
                SsePhaseEvents.sendPhase(
                        emitter, "rag_retrieval", "企业知识库向量检索中…");
                KnowledgeContextBundle kbBundle =
                        knowledgeRagService.retrieveContext(
                                req.getKnowledgeBaseId(),
                                userInput,
                                req.getRagTopK(),
                                req.getRagSimilarityThreshold());
                modelUserInput =
                        "【知识库摘录】\n"
                                + kbBundle.contextText()
                                + "\n\n【用户主诉】\n"
                                + userInput;
                sendKnowledgeMeta(emitter, kbBundle, req.getKnowledgeBaseId());
                SsePhaseEvents.sendPhase(
                        emitter, "model_stream", "大模型流式生成中…");
            } else if (hasLiterature) {
                SsePhaseEvents.sendPhase(
                        emitter, "rag_retrieval", "临时文献库向量检索中…");
                KnowledgeContextBundle litBundle =
                        literatureRagService.retrieveContextForConsultation(
                                litRaw.trim(),
                                userInput,
                                req.getLiteratureRagTopK(),
                                req.getLiteratureSimilarityThreshold());
                modelUserInput =
                        "【文献摘录】\n"
                                + litBundle.contextText()
                                + "\n\n【用户主诉】\n"
                                + userInput;
                sendLiteratureMeta(emitter, litBundle, litRaw.trim());
                SsePhaseEvents.sendPhase(
                        emitter, "model_stream", "大模型流式生成中…");
            } else {
                SsePhaseEvents.sendPhase(
                        emitter, "model_stream", "连接本地大模型…");
                modelUserInput = userInput;
            }

            subscribeConsultationModelStream(
                    emitter, req, historyMessages, modelUserInput, temperature, topP, userInput);
        } catch (Exception ex) {
            log.warn(
                    "consultation pipeline error sessionId={}",
                    req.getSessionId(),
                    ex);
            try {
                emitter.send(
                        SseEmitter.event().name("error").data(streamErrorMessage(ex)));
            } catch (IOException ignored) {
                // 客户端已断开时忽略
            }
            emitter.completeWithError(ex);
        }
    }

    private void sendKnowledgeMeta(
            SseEmitter emitter, KnowledgeContextBundle bundle, Long knowledgeBaseId)
            throws IOException {
        Map<String, Object> metaPayload = new LinkedHashMap<>();
        metaPayload.put("sources", bundle.sources());
        metaPayload.put("retrievedChunks", bundle.retrievedChunks());
        metaPayload.put("knowledgeBaseId", knowledgeBaseId);
        emitter.send(SseEmitter.event().name("meta").data(metaPayload));
    }

    private void sendLiteratureMeta(
            SseEmitter emitter, KnowledgeContextBundle bundle, String collectionId)
            throws IOException {
        Map<String, Object> metaPayload = new LinkedHashMap<>();
        metaPayload.put("sources", bundle.sources());
        metaPayload.put("retrievedChunks", bundle.retrievedChunks());
        metaPayload.put("literatureCollectionId", collectionId);
        emitter.send(SseEmitter.event().name("meta").data(metaPayload));
    }

    private void subscribeConsultationModelStream(
            SseEmitter emitter,
            ConsultationChatRequest req,
            List<Message> historyMessages,
            String modelUserInput,
            double temperature,
            double topP,
            String userInput) {
        ChatClient chatClient =
                ChatClient.builder(chatModel).defaultSystem(ConsultationPrompts.SYSTEM).build();

        // 将 temperature / top_p 一并下推到 Ollama Chat API，保证前端滑块与真实推理一致
        var streamSpec =
                chatClient
                        .prompt()
                        .options(
                                OllamaOptions.builder()
                                        .temperature(temperature)
                                        .topP(topP)
                                        .build())
                        .messages(historyMessages)
                        .user(modelUserInput)
                        .stream();

        StringBuilder assistantAcc = new StringBuilder();
        AtomicReference<Throwable> errorRef = new AtomicReference<>();

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
                                                .data(streamErrorMessage(ex)));
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
                                                    temperature,
                                                    topP);
                                        } catch (Exception ex) {
                                            log.error(
                                                    "Failed to persist consultation turn sessionId={}",
                                                    req.getSessionId(),
                                                    ex);
                                        }
                                    });
                        })
                .subscribe();
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

    private String streamErrorMessage(Throwable ex) {
        if (apiProperties.isExposeErrorDetails()) {
            return ex.getMessage() != null ? ex.getMessage() : "stream error";
        }
        return "stream error";
    }
}
