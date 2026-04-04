export type LiteratureUploadStatus = 'PENDING' | 'READY' | 'FAILED'

export interface LiteratureFileView {
  id: number
  tempCollectionId: string
  originalFilename: string
  fileUuid: string
  sizeBytes: number
  contentType: string
  status: LiteratureUploadStatus
  createdAt: string
  /** ISO-8601；临时库统一过期时刻，每次上传同库会顺延 */
  expiresAt?: string | null
}

export interface LiteratureQueryResponse {
  answer: string
  sources: string[]
  retrievedChunks: number
}
