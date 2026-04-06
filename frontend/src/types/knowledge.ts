/** 后端 KnowledgeBase 主要字段 */
export type KnowledgeBase = {
  id: number
  name: string
  vectorBackend: string
  embeddingModelName: string
  createdAt: string
}

/** 与后端 IngestionStatus 对齐 */
export type KnowledgeIngestionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'

export type KnowledgeFileView = {
  id: number
  originalFilename: string
  fileUuid: string
  sizeBytes: number
  contentType: string | null
  /** 已向量化分块数；排队/处理中/旧数据可能为 null */
  embedChunkCount: number | null
  createdAt: string
  status: KnowledgeIngestionStatus
  errorMessage: string | null
}

export type KnowledgeQueryResponse = {
  answer: string
  sources: string[]
  retrievedChunks: number
}
