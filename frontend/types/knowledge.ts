export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  document_count: number;
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
