package com.tcm.inquiry.modules.consultation.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.tcm.inquiry.modules.consultation.entity.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findBySession_IdOrderByIdAsc(Long sessionId);
}
