"use client";

import { Upload, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { TERMINAL } from "@/types/knowledge";
import type { KnowledgeBase, IngestJobState } from "@/types/knowledge";

interface KnowledgeUploadPanelProps {
  kbs: KnowledgeBase[];
  uploadKbId: string;
  setUploadKbId: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  ingestJobs: IngestJobState[];
  onPickFile: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function KnowledgeUploadPanel({
  kbs,
  uploadKbId,
  setUploadKbId,
  fileInputRef,
  ingestJobs,
  onPickFile,
  onFileChange,
}: KnowledgeUploadPanelProps) {
  return (
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
          accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onPickFile}
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
              <span className="flex shrink-0 items-center gap-2">
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
  );
}
