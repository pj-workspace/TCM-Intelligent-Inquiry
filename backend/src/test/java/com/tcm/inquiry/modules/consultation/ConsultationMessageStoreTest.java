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
import com.tcm.inquiry.modules.consultation.repository.ChatMessageRepository;
import com.tcm.inquiry.modules.consultation.repository.ChatSessionRepository;

@DataJpaTest(
        properties = {
            "spring.datasource.url=jdbc:sqlite::memory:",
            "spring.datasource.driver-class-name=org.sqlite.JDBC",
            "spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect",
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
        session.setTitle("t");
        ChatSession saved = chatSessionRepository.save(session);

        consultationMessageStore.saveTurn(
                saved.getId(), "hello", "hi there", "m1", 0.5);

        List<ChatMessage> rows = chatMessageRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getUserMessage()).isEqualTo("hello");
        assertThat(rows.get(0).getAssistantMessage()).isEqualTo("hi there");

        ChatSession reloaded =
                chatSessionRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getUpdatedAt()).isNotNull();
    }
}
