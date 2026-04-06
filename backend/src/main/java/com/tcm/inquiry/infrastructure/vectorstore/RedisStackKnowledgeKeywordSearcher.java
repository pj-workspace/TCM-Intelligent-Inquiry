package com.tcm.inquiry.infrastructure.vectorstore;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.redis.RedisVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import redis.clients.jedis.JedisPooled;
import redis.clients.jedis.search.Query;
import redis.clients.jedis.search.SearchResult;

/**
 * 使用 Redis Stack RediSearch 对 {@code content} 字段做关键字检索（与向量 KNN 并行），
 * 提升药材名、方剂等专有名词召回。失败时降级为空列表，不阻断语义检索。
 */
@Component
@Profile("!test & !ci")
public class RedisStackKnowledgeKeywordSearcher {

    private static final Logger log = LoggerFactory.getLogger(RedisStackKnowledgeKeywordSearcher.class);

    private final JedisPooled jedis;
    private final String indexName;
    private final String prefix;
    private final String contentFieldName;

    public RedisStackKnowledgeKeywordSearcher(
            JedisPooled jedis,
            @Value("${spring.ai.vectorstore.redis.index-name:tcm-spring-ai-index}") String indexName,
            @Value("${spring.ai.vectorstore.redis.prefix:tcm:emb:}") String prefix) {
        this.jedis = jedis;
        this.indexName = indexName;
        this.prefix = prefix;
        this.contentFieldName = RedisVectorStore.DEFAULT_CONTENT_FIELD_NAME;
    }

    public List<Document> searchKnowledgeBase(String kbId, List<String> terms, int limit) {
        if (!StringUtils.hasText(kbId) || terms == null || terms.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<String> clauses = new ArrayList<>();
        for (String raw : terms) {
            String safe = sanitizeTerm(raw);
            if (safe.length() >= 2) {
                clauses.add("@" + contentFieldName + ":(" + safe + ")");
            }
        }
        if (clauses.isEmpty()) {
            return List.of();
        }
        String tag = escapeTagValue(kbId.trim());
        String query =
                "(@kb_id:{" + tag + "}) (" + String.join(" | ", clauses) + ")";
        try {
            Query q =
                    new Query(query)
                            .setWithScores()
                            .limit(0, limit)
                            .returnFields(contentFieldName, "kb_id", "file_id", "source")
                            .dialect(2);
            SearchResult result = jedis.ftSearch(indexName, q);
            return result.getDocuments().stream()
                    .map(this::toDocument)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Redis FT 关键字检索失败，已跳过该路召回: {}", e.getMessage());
            return List.of();
        }
    }

    private static String sanitizeTerm(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replaceAll("[^\\p{IsHan}0-9a-zA-Z·．\\-']", "").trim();
    }

    /**
     * TAG 字段中的逗号、空格等需转义；数字 id 通常无需额外处理。
     */
    private static String escapeTagValue(String kbId) {
        return kbId.replace("\\", "\\\\").replace("-", "\\-");
    }

    private Document toDocument(redis.clients.jedis.search.Document doc) {
        String fullId = doc.getId();
        String stripped = fullId.startsWith(prefix) ? fullId.substring(prefix.length()) : fullId;
        String content =
                doc.hasProperty(contentFieldName) ? doc.getString(contentFieldName) : "";
        Map<String, Object> metadata = new HashMap<>();
        if (doc.hasProperty("kb_id")) {
            metadata.put("kb_id", doc.getString("kb_id"));
        }
        if (doc.hasProperty("file_id")) {
            metadata.put("file_id", doc.getString("file_id"));
        }
        if (doc.hasProperty("source")) {
            metadata.put("source", doc.getString("source"));
        }
        double bm25 = doc.getScore() != null ? doc.getScore() : 0.0;
        double norm = normalizeBm25(bm25);
        metadata.put("keyword_bm25", bm25);
        metadata.put("retrieval_score_keyword", norm);
        return Document.builder()
                .id(stripped)
                .text(content)
                .metadata(metadata)
                .score(norm)
                .build();
    }

    private static double normalizeBm25(double raw) {
        if (raw <= 0) {
            return 0.35;
        }
        return Math.min(1.0, Math.tanh(raw / 8.0));
    }
}
