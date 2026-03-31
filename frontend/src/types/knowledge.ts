/** 后端 KnowledgeBase 主要字段 */
export type KnowledgeBase = {
  id: number
  name: string
  vectorBackend: string
  embeddingModelName: string
  createdAt: string
}

export type KnowledgeFileView = {
  id: number
  originalFilename: string
  fileUuid: string
  sizeBytes: number
  contentType: string | null
  createdAt: string
}

export type KnowledgeQueryResponse = {
  answer: string
  sources: string[]
  retrievedChunks: number
}
