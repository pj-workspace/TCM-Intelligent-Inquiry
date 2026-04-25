"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiHeaders, apiJsonHeaders, parseApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Database, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";

type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  document_count: number;
};

type IngestJobState = {
  kbId: string;
  filename: string;
  jobId: string;
  status: string;
  error?: string | null;
};

const JOB_POLL_MS = 2000;
const TERMINAL = new Set(["completed", "failed"]);

export function KnowledgeTab() {
  const { token } = useAuth();
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
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e));
        }
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
              const err =
                (errMsg && String(errMsg).trim()) || "入库失败";
              toast.error(`「${j.filename}」${err}`);
            }
          }
          return { ...j, status: st, error: errMsg };
        })
      );
      if (TERMINAL.has(st)) {
        stopPoll(jobId);
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

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token || !uploadKbId) {
      if (!uploadKbId) {
        toast.warning("请先选择要上传到的知识库");
      }
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
        {
          kbId: uploadKbId,
          filename: file.name,
          jobId,
          status: "pending",
        },
      ]);
      startPoll(jobId);
      toast.success("已提交入库任务，请稍候查看进度");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <ConfirmDialog
        open={deleteId !== null}
        title="删除知识库"
        description="确定删除该知识库吗？库内向量与元数据将一并删除，且不可恢复。"
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        pending={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => !isDeleting && setDeleteId(null)}
      />

      <div>
        <h2 className="text-lg font-semibold text-gray-900">知识库</h2>
        <p className="mt-1 text-sm text-gray-500">
          创建个人知识库并上传 PDF、TXT 或 Markdown 文档，供对话中「检索知识库」工具使用。
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-sm"
      >
        <h3 className="text-sm font-medium text-gray-900">新建知识库</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            placeholder="名称 *"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            placeholder="说明（可选）"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "创建中…" : "创建"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-medium text-gray-900">上传文档</h3>
        <p className="mt-1 text-xs text-gray-500">
          选择知识库后上传文件；大文件将异步入库，下方可查看进度。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs text-gray-500">目标知识库</label>
            <Select
              className="mt-1"
              value={uploadKbId}
              onValueChange={setUploadKbId}
              placeholder="请选择知识库"
              options={[
                { value: "", label: "请选择…" },
                ...kbs.map((k) => ({
                  value: k.id,
                  label: `${k.name}（${k.document_count} 篇）`,
                })),
              ]}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handlePickFile}
            disabled={!uploadKbId}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            选择文件
          </button>
        </div>
        {ingestJobs.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            {ingestJobs.map((j) => (
              <li
                key={j.jobId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="truncate text-gray-700">
                  {j.filename}
                  <span className="ml-2 font-mono text-xs text-gray-400">
                    {j.jobId.slice(0, 8)}…
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {!TERMINAL.has(j.status) && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                  )}
                  <span
                    className={
                      j.status === "failed"
                        ? "text-red-600"
                        : j.status === "completed"
                          ? "text-green-600"
                          : "text-gray-600"
                    }
                  >
                    {j.status}
                  </span>
                </span>
                {j.error && (
                  <p className="w-full text-xs text-red-600">{j.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">我的知识库</h3>
        {kbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
            <Database className="mb-3 h-8 w-8 text-gray-300" />
            <p>暂无知识库</p>
            <p className="mt-1 text-xs">在上方创建后即可上传文档</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {kbs.map((k) => (
              <div
                key={k.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{k.name}</div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    文档数：{k.document_count} · ID:{" "}
                    <span className="font-mono">{k.id}</span>
                  </p>
                  {k.description ? (
                    <p className="mt-2 text-sm text-gray-600">{k.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  title="删除"
                  onClick={() => setDeleteId(k.id)}
                  className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
