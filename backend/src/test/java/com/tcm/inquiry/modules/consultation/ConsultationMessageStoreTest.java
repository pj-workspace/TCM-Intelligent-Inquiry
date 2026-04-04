package com.tcm.inquiry.modules.consultation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.tcm.inquiry.modules.consultation.entity.ChatMessage;
import com.tcm.inquiry.modules.consultation.entity.ChatSession;
import com.tcm.inquiry.modules.consultation.config.ConsultationJpaConfig;
import com.tcm.inquiry.modules.consultation.repository.ChatMessageRepository;
import com.tcm.inquiry.modules.consultation.repository.ChatSessionRepository;
import com.tcm.inquiry.modules.consultation.service.ConsultationMessageStore;

@DataJpaTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:consultation_msg_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "spring.datasource.driver-class-name=org.h2.Driver",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
            "spring.jpa.hibernate.ddl-auto=create-drop",
        })
@Import({ConsultationJpaConfig.class, ConsultationMessageStore.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ConsultationMessageStoreTest {

    @Autowired private ChatSessionRepository chatSessionRepository;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private ConsultationMessageStore consultationMessageStore;

    @Test
    void saveTurnPersistsMessageAndTouchesSession() {
        ChatSession session = new ChatSession();
        session.setTitle("新会话");
        ChatSession saved = chatSessionRepository.save(session);

        consultationMessageStore.saveTurn(
                saved.getId(), "hello", "hi there", "m1", 0.5, 0.9);

        List<ChatMessage> rows = chatMessageRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getUserMessage()).isEqualTo("hello");
        assertThat(rows.get(0).getAssistantMessage()).isEqualTo("hi there");

        ChatSession reloaded =
                chatSessionRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getUpdatedAt()).isNotNull();
        assertThat(reloaded.getTitle()).isEqualTo("hello");
        assertThat(rows.get(0).getGenerationParamsJson())
                .isNotNull()
                .contains("topP")
                .contains("0.9");
    }

    @Test
    void saveTurnDoesNotOverwriteCustomTitle() {
        ChatSession session = new ChatSession();
        session.setTitle("已有标题");
        ChatSession saved = chatSessionRepository.save(session);

        consultationMessageStore.saveTurn(
                saved.getId(), "next user", "reply", "m", 0.5, null);

        ChatSession reloaded =
                chatSessionRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getTitle()).isEqualTo("已有标题");
        List<ChatMessage> rows = chatMessageRepository.findAll();
        assertThat(rows.get(0).getGenerationParamsJson()).isNull();
    }
}
