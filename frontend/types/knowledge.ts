export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  document_count: number;
  total_chunks?: number;
  embedding_provider?: string | null;
  embedding_model?: string | null;
  embedding_dim?: number | null;
};

export type KnowledgeDocument = {
  id: string;
  kb_id: string;
  filename: string;
  chunk_count: number;
  file_size: number;
  created_at: string;
};

export type SearchResult = {
  content: string;
  source: string;
  score: number;
};

export type IngestJobState = {
  kbId: string;
  filename: string;
  jobId: string;
  status: string;
  error?: string | null;
  fileBlob?: File;
  /** 上传阶段的字节进度（0-100），上传完成后为 undefined */
  uploadProgress?: number;
  /** 服务端处理阶段名称：extracting / chunking / embedding / writing / done */
  phase?: string;
  /** 服务端处理进度（0-100），来自后端 job 状态接口 */
  serverProgress?: number;
};

export const JOB_POLL_MS = 2000;
export const TERMINAL = new Set(["completed", "failed"]);
