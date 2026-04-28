export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  document_count: number;
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
};

export const JOB_POLL_MS = 2000;
export const TERMINAL = new Set(["completed", "failed"]);
