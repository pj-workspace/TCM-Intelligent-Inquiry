import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/core/client'
import type { ApiResult } from '@/types/api'
import type { KnowledgeBase, KnowledgeFileView } from '@/types/knowledge'

export function getKnowledgeHealth(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<string>>('/v1/knowledge/health', config)
}

export function listKnowledgeBases(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<KnowledgeBase[]>>('/v1/knowledge/bases', config)
}

export function createKnowledgeBase(
  body: { name: string; embeddingModel: string },
  config?: AxiosRequestConfig
) {
  return apiClient.post<ApiResult<KnowledgeBase>>('/v1/knowledge/bases', body, config)
}

export function listKnowledgeDocuments(
  knowledgeBaseId: number,
  config?: AxiosRequestConfig
) {
  return apiClient.get<ApiResult<KnowledgeFileView[]>>(
    `/v1/knowledge/bases/${knowledgeBaseId}/documents`,
    config
  )
}

export function uploadKnowledgeDocument(
  knowledgeBaseId: number,
  formData: FormData,
  config?: AxiosRequestConfig
) {
  return apiClient.post<ApiResult<KnowledgeFileView>>(
    `/v1/knowledge/bases/${knowledgeBaseId}/documents`,
    formData,
    config
  )
}

export function deleteKnowledgeDocument(
  knowledgeBaseId: number,
  fileUuid: string,
  config?: AxiosRequestConfig
) {
  return apiClient.delete<ApiResult<unknown>>(
    `/v1/knowledge/bases/${knowledgeBaseId}/documents/${fileUuid}`,
    config
  )
}
