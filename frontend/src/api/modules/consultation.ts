import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/core/client'
import type { ApiResult } from '@/types/api'
import type { ChatMessageView, ChatSessionInfo } from '@/types/consultation'

/** 问诊 SSE 聊天（完整 URL，供 fetch 使用）。 */
export const CONSULTATION_CHAT_STREAM_URL = '/api/v1/consultation/chat'

export function getConsultationHealth(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<string>>('/v1/consultation/health', config)
}

export function listConsultationSessions(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<ChatSessionInfo[]>>(
    '/v1/consultation/sessions',
    config
  )
}

export function createConsultationSession(config?: AxiosRequestConfig) {
  return apiClient.post<ApiResult<ChatSessionInfo>>(
    '/v1/consultation/sessions',
    {},
    config
  )
}

export function listConsultationMessages(
  sessionId: number,
  config?: AxiosRequestConfig
) {
  return apiClient.get<ApiResult<ChatMessageView[]>>(
    `/v1/consultation/sessions/${sessionId}/messages`,
    config
  )
}

export function deleteConsultationSession(
  sessionId: number,
  config?: AxiosRequestConfig
) {
  return apiClient.delete<ApiResult<unknown>>(
    `/v1/consultation/sessions/${sessionId}`,
    config
  )
}
