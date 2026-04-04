import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/core/client'
import type { ApiResult } from '@/types/api'
import type { LiteratureFileView, LiteratureQueryResponse } from '@/types/literature'

export function getLiteratureHealth(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<string>>('/v1/literature/health', config)
}

export function listLiteratureCollectionFiles(
  collectionId: string,
  config?: AxiosRequestConfig
) {
  return apiClient.get<ApiResult<LiteratureFileView[]>>(
    `/v1/literature/collections/${encodeURIComponent(collectionId)}/files`,
    config
  )
}

export function uploadLiteratureFile(
  formData: FormData,
  config?: AxiosRequestConfig
) {
  return apiClient.post<ApiResult<LiteratureFileView>>(
    '/v1/literature/uploads',
    formData,
    config
  )
}

export function deleteLiteratureDocument(
  collectionId: string,
  fileUuid: string,
  config?: AxiosRequestConfig
) {
  return apiClient.delete(
    `/v1/literature/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileUuid)}`,
    config
  )
}

export function deleteLiteratureCollection(
  collectionId: string,
  config?: AxiosRequestConfig
) {
  return apiClient.delete(
    `/v1/literature/collections/${encodeURIComponent(collectionId)}`,
    config
  )
}

/**
 * 对指定临时文献库发起一次非流式 RAG 问答（与智能问诊中文献模式同源接口），不写入问诊会话。
 */
export function queryLiteratureCollection(
  collectionId: string,
  body: {
    message: string
    topK?: number
    similarityThreshold?: number
  },
  config?: AxiosRequestConfig
) {
  return apiClient.post<ApiResult<LiteratureQueryResponse>>(
    `/v1/literature/collections/${encodeURIComponent(collectionId)}/query`,
    body,
    config
  )
}

export function listLiteratureUploads(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<LiteratureFileView[]>>(
    '/v1/literature/uploads',
    config
  )
}
