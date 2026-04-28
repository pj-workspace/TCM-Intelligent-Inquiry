"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiHeaders, apiJsonHeaders, parseApiError } from "@/lib/api";
import { toast } from "sonner";
import { JOB_POLL_MS, TERMINAL } from "@/types/knowledge";
import type {
  IngestJobState,
  KnowledgeBase,
  KnowledgeDocument,
  SearchResult,
} from "@/types/knowledge";

// =====================================================================
// useKnowledge：聚合知识库相关的所有客户端状态与异步行为。
// 区域：KB CRUD / 上传与轮询 / 文档管理 / 检索测试
// =====================================================================
export function useKnowledge(token: string | null) {
  // ---------- KB 列表与新建 ----------
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // ---------- KB 删除 ----------
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---------- KB 编辑 ----------
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // ---------- 上传 ----------
  const [uploadKbId, setUploadKbId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ingestJobs, setIngestJobs] = useState<IngestJobState[]>([]);
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map()
  );

  // ---------- 文档列表 ----------
  const [expandedKbId, setExpandedKbId] = useState<string | null>(null);
  const [documentsCache, setDocumentsCache] = useState<
    Map<string, KnowledgeDocument[]>
  >(new Map());
  const [docLoading, setDocLoading] = useState<Map<string, boolean>>(new Map());
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<{
    kbId: string;
    doc: KnowledgeDocument;
  } | null>(null);
  const inFlightDocsRef = useRef<Set<string>>(new Set());

  // ---------- 检索 ----------
  const [searchKbId, setSearchKbId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTopK, setSearchTopK] = useState(5);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchedKbId, setLastSearchedKbId] = useState<string>("");

  // =====================================================================
  // KB CRUD
  // =====================================================================
  const fetchKbs = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/knowledge`, {
      headers: apiHeaders(token),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const data = (await res.json()) as { knowledge_bases?: KnowledgeBase[] };
    setKbs(data.knowledge_bases || []);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        await fetchKbs();
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, fetchKbs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/knowledge`, {
        method: "POST",
        headers: apiJsonHeaders(token),
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setNewName("");
      setNewDesc("");
      await fetchKbs();
      toast.success("知识库已创建");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = useCallback(
    async (
      kbId: string,
      data: { name?: string; description?: string }
    ) => {
      if (!token) return;
      const payload: Record<string, string> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description;
      if (Object.keys(payload).length === 0) {
        setEditingKb(null);
        return;
      }
      setIsUpdating(true);
      try {
        const res = await fetch(`${API_BASE}/api/knowledge/${kbId}`, {
          method: "PATCH",
          headers: apiJsonHeaders(token),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        await fetchKbs();
        setEditingKb(null);
        toast.success("知识库已更新");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "更新失败");
      } finally {
        setIsUpdating(false);
      }
    },
    [token, fetchKbs]
  );

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/${deleteId}`, {
        method: "DELETE",
        headers: apiHeaders(token),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      if (uploadKbId === deleteId) setUploadKbId("");
      if (searchKbId === deleteId) setSearchKbId("");
      if (expandedKbId === deleteId) setExpandedKbId(null);
      setDocumentsCache((prev) => {
        if (!prev.has(deleteId)) return prev;
        const next = new Map(prev);
        next.delete(deleteId);
        return next;
      });
      setDeleteId(null);
      await fetchKbs();
      toast.success("知识库已删除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  // =====================================================================
  // 上传 + 任务轮询
  // =====================================================================
  const stopPoll = useCallback((jobId: string) => {
    const t = pollTimersRef.current.get(jobId);
    if (t) clearInterval(t);
    pollTimersRef.current.delete(jobId);
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/knowledge/jobs/${jobId}`, {
        headers: apiHeaders(token),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setIngestJobs((prev) =>
          prev.map((j) =>
            j.jobId === jobId ? { ...j, status: "failed", error: msg } : j
          )
        );
        stopPoll(jobId);
        toast.error(`入库状态查询失败：${msg}`);
        return;
      }
      const data = (await res.json()) as {
        status?: string;
        error?: string | null;
      };
      const st = data.status || "unknown";
      let completedKbId: string | null = null;
      setIngestJobs((prev) =>
        prev.map((j) => {
          if (j.jobId !== jobId) return j;
          const wasTerminal = TERMINAL.has(j.status);
          const errMsg = data.error ?? null;
          if (!wasTerminal && TERMINAL.has(st)) {
            if (st === "completed") {
              completedKbId = j.kbId;
              toast.success(`「${j.filename}」已入库完成`);
            } else if (st === "failed") {
              const err = (errMsg && String(errMsg).trim()) || "入库失败";
              toast.error(`「${j.filename}」${err}`);
            }
          }
          return { ...j, status: st, error: errMsg };
        })
      );
      if (TERMINAL.has(st)) {
        stopPoll(jobId);
        if (completedKbId) {
          void fetchKbs();
          // 若该 KB 当前已展开，刷新文档列表
          setDocumentsCache((prev) => {
            if (!prev.has(completedKbId!)) return prev;
            const next = new Map(prev);
            next.delete(completedKbId!);
            return next;
          });
        }
      }
    },
    [token, fetchKbs, stopPoll]
  );

  const startPoll = useCallback(
    (jobId: string) => {
      if (pollTimersRef.current.has(jobId)) return;
      void pollJob(jobId);
      const id = setInterval(() => void pollJob(jobId), JOB_POLL_MS);
      pollTimersRef.current.set(jobId, id);
    },
    [pollJob]
  );

  useEffect(() => {
    const ref = pollTimersRef;
    return () => {
      const timers = ref.current;
      for (const [, id] of timers) clearInterval(id);
      timers.clear();
    };
  }, []);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token || !uploadKbId) {
      if (!uploadKbId) toast.warning("请先选择要上传到的知识库");
      return;
    }
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".pdf") &&
      !lower.endsWith(".txt") &&
      !lower.endsWith(".md") &&
      !lower.endsWith(".docx")
    ) {
      toast.error("仅支持 PDF、TXT、Markdown（.md）、Word（.docx）文件");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/knowledge/${uploadKbId}/ingest-async`,
        {
          method: "POST",
          headers: apiHeaders(token),
          body: fd,
        }
      );
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { job_id?: string };
      const jobId = data.job_id;
      if (!jobId) throw new Error("未返回 job_id");
      setIngestJobs((prev) => [
        ...prev,
        { kbId: uploadKbId, filename: file.name, jobId, status: "pending" },
      ]);
      startPoll(jobId);
      toast.success("已提交入库任务，请稍候查看进度");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    }
  };

  // =====================================================================
  // 文档管理
  // =====================================================================
  const fetchDocuments = useCallback(
    async (kbId: string) => {
      if (!token) return;
      if (inFlightDocsRef.current.has(kbId)) return;
      inFlightDocsRef.current.add(kbId);
      setDocLoading((prev) => {
        const m = new Map(prev);
        m.set(kbId, true);
        return m;
      });
      try {
        const res = await fetch(
          `${API_BASE}/api/knowledge/${kbId}/documents`,
          { headers: apiHeaders(token) }
        );
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = (await res.json()) as
          | KnowledgeDocument[]
          | { documents?: KnowledgeDocument[] };
        const docs = Array.isArray(data) ? data : data.documents ?? [];
        setDocumentsCache((prev) => {
          const m = new Map(prev);
          m.set(kbId, docs);
          return m;
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "获取文档失败");
      } finally {
        inFlightDocsRef.current.delete(kbId);
        setDocLoading((prev) => {
          const m = new Map(prev);
          m.set(kbId, false);
          return m;
        });
      }
    },
    [token]
  );

  const toggleExpand = useCallback(
    (kbId: string) => {
      setExpandedKbId((prev) => (prev === kbId ? null : kbId));
    },
    []
  );

  // 展开后若尚未缓存，自动拉取一次。
  useEffect(() => {
    if (!expandedKbId) return;
    if (documentsCache.has(expandedKbId)) return;
    if (inFlightDocsRef.current.has(expandedKbId)) return;
    void fetchDocuments(expandedKbId);
  }, [expandedKbId, documentsCache, fetchDocuments]);

  const deleteDocument = useCallback(
    async (kbId: string, docId: string) => {
      if (!token) return;
      setDeletingDocId(docId);
      try {
        const res = await fetch(
          `${API_BASE}/api/knowledge/${kbId}/documents/${docId}`,
          {
            method: "DELETE",
            headers: apiHeaders(token),
          }
        );
        if (!res.ok) throw new Error(await parseApiError(res));
        setDocumentsCache((prev) => {
          const list = prev.get(kbId);
          if (!list) return prev;
          const m = new Map(prev);
          m.set(
            kbId,
            list.filter((d) => d.id !== docId)
          );
          return m;
        });
        setPendingDeleteDoc(null);
        await fetchKbs();
        toast.success("文档已删除");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除文档失败");
      } finally {
        setDeletingDocId(null);
      }
    },
    [token, fetchKbs]
  );

  // =====================================================================
  // 检索
  // =====================================================================
  const searchKb = useCallback(
    async (kbId: string, query: string, topK: number) => {
      if (!token) return;
      if (!kbId) {
        toast.warning("请先选择要检索的知识库");
        return;
      }
      const q = query.trim();
      if (!q) {
        toast.warning("请输入查询语句");
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/knowledge/${kbId}/search`, {
          method: "POST",
          headers: apiJsonHeaders(token),
          body: JSON.stringify({ query: q, top_k: topK }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = (await res.json()) as {
          results?: SearchResult[];
          query?: string;
        };
        setSearchResults(data.results ?? []);
        setLastSearchedKbId(kbId);
        setHasSearched(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "检索失败");
      } finally {
        setSearching(false);
      }
    },
    [token]
  );

  return {
    // KB 列表与新建
    kbs,
    loading,
    error,
    creating,
    newName,
    setNewName,
    newDesc,
    setNewDesc,
    handleCreate,
    // KB 删除
    deleteId,
    setDeleteId,
    isDeleting,
    confirmDelete,
    // KB 编辑
    editingKb,
    setEditingKb,
    isUpdating,
    handleUpdate,
    // 上传
    uploadKbId,
    setUploadKbId,
    ingestJobs,
    fileInputRef,
    handlePickFile,
    handleFileChange,
    // 文档
    expandedKbId,
    documentsCache,
    docLoading,
    deletingDocId,
    pendingDeleteDoc,
    setPendingDeleteDoc,
    toggleExpand,
    fetchDocuments,
    deleteDocument,
    // 检索
    searchKbId,
    setSearchKbId,
    searchQuery,
    setSearchQuery,
    searchTopK,
    setSearchTopK,
    searchResults,
    searching,
    hasSearched,
    lastSearchedKbId,
    searchKb,
  };
}
