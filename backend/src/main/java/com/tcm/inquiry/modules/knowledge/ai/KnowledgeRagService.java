package com.tcm.inquiry.modules.knowledge.ai;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.tcm.inquiry.common.sse.SsePhaseEvents;
import com.tcm.inquiry.config.TcmApiProperties;
import com.tcm.inquiry.modules.knowledge.config.KnowledgeProperties;
import com.tcm.inquiry.modules.knowledge.dto.req.KnowledgeQueryRequest;
import com.tcm.inquiry.modules.knowledge.dto.resp.KnowledgeQueryResponse;
import com.tcm.inquiry.modules.knowledge.repository.KnowledgeBaseRepository;

import reactor.core.scheduler.Schedulers;

@Service
public class KnowledgeRagService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final VectorStore vectorStore;
    private final ChatModel chatModel;
    private final KnowledgeProperties knowledgeProperties;
    private final Executor sseAsyncExecutor;
    private final TcmApiProperties apiProperties;

    public KnowledgeRagService(
            KnowledgeBaseRepository knowledgeBaseRepository,
            VectorStore vectorStore,
            @Qualifier("ollamaChatModel") ChatModel chatModel,
            KnowledgeProperties knowledgeProperties,
            @Qualifier("sseAsyncExecutor") Executor sseAsyncExecutor,
            TcmApiProperties apiProperties) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.vectorStore = vectorStore;
        this.chatModel = chatModel;
        this.knowledgeProperties = knowledgeProperties;
        this.sseAsyncExecutor = sseAsyncExecutor;
        this.apiProperties = apiProperties;
    }

    public KnowledgeQueryResponse query(Long knowledgeBaseId, KnowledgeQueryRequest req) {
        KnowledgeContextBundle bundle =
                retrieveContext(
                        knowledgeBaseId,
                        req.getMessage(),
                        req.getTopK(),
                        req.getSimilarityThreshold());
        String userPrompt = buildUserPrompt(bundle, req.getMessage());

        ChatClient client =
                ChatClient.builder(chatModel).defaultSystem(KnowledgeRagPrompts.RAG_SYSTEM).build();
        String answer = client.prompt().user(userPrompt).call().content();

        return new KnowledgeQueryResponse(
                answer, new ArrayList<>(bundle.sources()), bundle.retrievedChunks());
    }

    /**
     * RAG 流式回答：先发 {@code event: phase}（检索/生成），再 {@code meta}，正文增量同问诊，最后 {@code
     * [DONE]}。
     */
    public SseEmitter streamQuery(Long knowledgeBaseId, KnowledgeQueryRequest req) {
        SseEmitter emitter = new SseEmitter(600_000L);

        sseAsyncExecutor.execute(
                () -> {
                    try {
                        SsePhaseEvents.sendPhase(
                                emitter, "rag_retrieval", "知识库向量检索中…");
                        KnowledgeContextBundle bundle =
                                retrieveContext(
                                        knowledgeBaseId,
                                        req.getMessage(),
                                        req.getTopK(),
                                        req.getSimilarityThreshold());
                        emitter.send(
                                SseEmitter.event()
                                        .name("meta")
                                        .data(
                                                Map.of(
                                                        "sources",
                                                        bundle.sources(),
                                                        "retrievedChunks",
                                                        bundle.retrievedChunks())));
                        SsePhaseEvents.sendPhase(
                                emitter, "model_stream", "大模型流式生成中…");

                        String userPrompt = buildUserPrompt(bundle, req.getMessage());
                        ChatClient client =
                                ChatClient.builder(chatModel)
                                        .defaultSystem(KnowledgeRagPrompts.RAG_SYSTEM)
                                        .build();
                        var streamSpec = client.prompt().user(userPrompt).stream();
                        AtomicReference<Throwable> errorRef = new AtomicReference<>();

                        streamSpec
                                .content()
                                .subscribeOn(Schedulers.boundedElastic())
                                .doOnNext(
                                        token -> {
                                            try {
                                                emitter.send(SseEmitter.event().data(token));
                                            } catch (IOException e) {
                                                errorRef.compareAndSet(null, e);
                                                emitter.completeWithError(e);
                                            }
                                        })
                                .doOnError(
                                        ex -> {
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
                                        })
                                .subscribe();
                    } catch (Exception ex) {
                        try {
                            emitter.send(
                                    SseEmitter.event()
                                            .name("error")
                                            .data(streamErrorMessage(ex)));
                        } catch (IOException ignored) {
                            // ignore
                        }
                        emitter.completeWithError(ex);
                    }
                });

        emitter.onTimeout(emitter::complete);
        emitter.onCompletion(() -> {});

        return emitter;
    }

    private static String buildUserPrompt(KnowledgeContextBundle bundle, String rawMessage) {
        return "参考资料：\n"
                + bundle.contextText()
                + "\n用户问题：\n"
                + rawMessage.trim()
                + "\n请根据资料作答。";
    }

    private String streamErrorMessage(Throwable ex) {
        if (apiProperties.isExposeErrorDetails()) {
            return ex.getMessage() != null ? ex.getMessage() : "stream error";
        }
        return "stream error";
    }

    /**
     * 仅向量检索 + 拼装上下文，不调用大模型（供智能体组合图文任务使用）。
     */
    public KnowledgeContextBundle retrieveContext(
            Long knowledgeBaseId,
            String queryText,
            Integer topKOverride,
            Double similarityThresholdOverride) {
        if (!knowledgeBaseRepository.existsById(knowledgeBaseId)) {
            throw new IllegalArgumentException("knowledge base not found: " + knowledgeBaseId);
        }

        Filter.Expression kbOnly =
                new FilterExpressionBuilder().eq("kb_id", String.valueOf(knowledgeBaseId)).build();

        int topK =
                topKOverride != null && topKOverride > 0
                        ? topKOverride
                        : knowledgeProperties.getDefaultTopK();
        double th =
                similarityThresholdOverride != null
                        ? similarityThresholdOverride
                        : knowledgeProperties.getDefaultSimilarityThreshold();

        SearchRequest.Builder searchBuilder =
                SearchRequest.builder()
                        .query(queryText.trim())
                        .topK(topK)
                        .filterExpression(kbOnly);
        if (th <= 0) {
            searchBuilder.similarityThresholdAll();
        } else {
            searchBuilder.similarityThreshold(th);
        }

        List<Document> hits = vectorStore.similaritySearch(searchBuilder.build());

        StringBuilder context = new StringBuilder();
        Set<String> sources = new LinkedHashSet<>();
        for (Document d : hits) {
            String t = d.getText();
            if (t != null && !t.isBlank()) {
                context.append(t).append("\n---\n");
            }
            Object src = d.getMetadata().get("source");
            if (src != null) {
                sources.add(src.toString());
            }
        }

        String ctxText = context.toString();
        if (ctxText.isBlank()) {
            ctxText = "（当前知识库中暂无与问题相关的检索片段。）\n";
        }

        return new KnowledgeContextBundle(ctxText, new ArrayList<>(sources), hits.size());
    }
}
