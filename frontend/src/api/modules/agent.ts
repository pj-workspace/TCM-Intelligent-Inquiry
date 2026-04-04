import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/core/client'
import type { ApiResult } from '@/types/api'
import type { AgentConfigView, AgentRunResponse } from '@/types/agent'

export function getAgentHealth(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<string>>('/v1/agent/health', config)
}

export function getAgentConfig(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<AgentConfigView>>('/v1/agent/config', config)
}

export function updateAgentConfig(
  body: {
    displayName: string
    textSystemPrompt: string | null
    visionSystemPrompt: string | null
    visionModelName: string | null
    defaultKnowledgeBaseId: number | null
  },
  config?: AxiosRequestConfig
) {
  return apiClient.put<ApiResult<AgentConfigView>>('/v1/agent/config', body, config)
}

export function postAgentRunJson(
  body: Record<string, unknown>,
  config?: AxiosRequestConfig
) {
  return apiClient.post<ApiResult<AgentRunResponse>>('/v1/agent/run', body, config)
}

export function postAgentRunMultipart(
  formData: FormData,
  config?: AxiosRequestConfig
) {
  return apiClient.post<ApiResult<AgentRunResponse>>(
    '/v1/agent/run',
    formData,
    config
  )
}
