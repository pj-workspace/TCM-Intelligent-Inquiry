"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiHeaders, apiJsonHeaders, parseApiError } from "@/lib/api";
import { toast } from "sonner";
import { JOB_POLL_MS, TERMINAL } from "@/types/knowledge";
import type { KnowledgeBase, IngestJobState } from "@/types/knowledge";

export function useKnowledge(token: string | null) {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadKbId, setUploadKbId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ingestJobs, setIngestJobs] = useState<IngestJobState[]>([]);
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map()
  );

  const fetchKbs = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/knowledge`, {
      headers: apiHeaders(token),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const data = (await res.json()) as {
      knowledge_bases?: KnowledgeBase[];
    };
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
      setIngestJobs((prev) =>
        prev.map((j) => {
          if (j.jobId !== jobId) return j;
          const wasTerminal = TERMINAL.has(j.status);
          const errMsg = data.error ?? null;
          if (!wasTerminal && TERMINAL.has(st)) {
            if (st === "completed") {
              void fetchKbs();
              toast.success(`「${j.filename}」已入库完成`);
            } else if (st === "failed") {
              const err = (errMsg && String(errMsg).trim()) || "入库失败";
              toast.error(`「${j.filename}」${err}`);
            }
          }
          return { ...j, status: st, error: errMsg };
        })
      );
      if (TERMINAL.has(st)) stopPoll(jobId);
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
      setDeleteId(null);
      await fetchKbs();
      toast.success("知识库已删除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

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
      !lower.endsWith(".md")
    ) {
      toast.error("仅支持 PDF、TXT、Markdown（.md）文件");
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

  return {
    kbs,
    loading,
    error,
    creating,
    newName,
    setNewName,
    newDesc,
    setNewDesc,
    deleteId,
    setDeleteId,
    isDeleting,
    uploadKbId,
    setUploadKbId,
    ingestJobs,
    fileInputRef,
    handleCreate,
    confirmDelete,
    handlePickFile,
    handleFileChange,
  };
}
