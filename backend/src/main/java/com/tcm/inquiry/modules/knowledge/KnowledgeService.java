package com.tcm.inquiry.modules.knowledge;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class KnowledgeService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final String defaultEmbeddingModelName;

    public KnowledgeService(
            KnowledgeBaseRepository knowledgeBaseRepository,
            @Value("${spring.ai.ollama.embedding.options.model:bge-m3:latest}")
                    String defaultEmbeddingModelName) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.defaultEmbeddingModelName = defaultEmbeddingModelName;
    }

    @Transactional(readOnly = true)
    public List<KnowledgeBase> listBases() {
        return knowledgeBaseRepository.findAll();
    }

    @Transactional
    public KnowledgeBase createBase(String name, String embeddingModelName) {
        String model =
                embeddingModelName == null || embeddingModelName.isBlank()
                        ? defaultEmbeddingModelName
                        : embeddingModelName.trim();
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName(name);
        kb.setVectorBackend(VectorBackend.OLLAMA);
        kb.setEmbeddingModelName(model);
        kb.setCreatedAt(Instant.now());
        return knowledgeBaseRepository.save(kb);
    }
}
