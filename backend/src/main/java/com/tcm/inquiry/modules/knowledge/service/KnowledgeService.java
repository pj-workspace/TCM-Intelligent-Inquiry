package com.tcm.inquiry.modules.knowledge.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import com.tcm.inquiry.modules.knowledge.ai.VectorBackend;
import com.tcm.inquiry.modules.knowledge.entity.KnowledgeBase;
import com.tcm.inquiry.modules.knowledge.repository.KnowledgeBaseRepository;

@Service
public class KnowledgeService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final String defaultEmbeddingModelName;

    public KnowledgeService(
            KnowledgeBaseRepository knowledgeBaseRepository,
            @Value("${spring.ai.openai.embedding.options.model:text-embedding-v4}")
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
        kb.setVectorBackend(VectorBackend.DASHSCOPE);
        kb.setEmbeddingModelName(model);
        kb.setCreatedAt(Instant.now());
        return knowledgeBaseRepository.save(kb);
    }
}
