"use client";

import { Database, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useKnowledge } from "@/hooks/useKnowledge";
import { KnowledgeUploadPanel } from "./KnowledgeUploadPanel";

export function KnowledgeTab() {
  const { token } = useAuth();
  const {
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
  } = useKnowledge(token);

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

      <KnowledgeUploadPanel
        kbs={kbs}
        uploadKbId={uploadKbId}
        setUploadKbId={setUploadKbId}
        fileInputRef={fileInputRef}
        ingestJobs={ingestJobs}
        onPickFile={handlePickFile}
        onFileChange={handleFileChange}
      />

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
