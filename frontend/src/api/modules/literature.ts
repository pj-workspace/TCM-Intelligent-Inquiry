import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/core/client'
import type { ApiResult } from '@/types/api'
import type { LiteratureFileView } from '@/types/literature'

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

export function listLiteratureUploads(config?: AxiosRequestConfig) {
  return apiClient.get<ApiResult<LiteratureFileView[]>>(
    '/v1/literature/uploads',
    config
  )
}
