package com.tcm.inquiry.modules.consultation.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.tcm.inquiry.modules.consultation.entity.ChatSession;

public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {

    List<ChatSession> findAllByOrderByUpdatedAtDesc();
}
