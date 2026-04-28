"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { formatFileSize } from "@/lib/format";
import type { KnowledgeBase, KnowledgeDocument } from "@/types/knowledge";

interface KnowledgeBaseCardProps {
  kb: KnowledgeBase;
  expanded: boolean;
  documents: KnowledgeDocument[] | undefined;
  loadingDocs: boolean;
  deletingDocId: string | null;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRequestDeleteDoc: (doc: KnowledgeDocument) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN");
  } catch {
    return iso;
  }
}

export function KnowledgeBaseCard({
  kb,
  expanded,
  documents,
  loadingDocs,
  deletingDocId,
  onToggleExpand,
  onEdit,
  onDelete,
  onRequestDeleteDoc,
}: KnowledgeBaseCardProps) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggleExpand}
          className="-ml-1 mt-0.5 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={expanded ? "收起文档列表" : "展开文档列表"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="min-w-0 flex-1 text-left"
        >
          <div className="font-medium text-gray-900">{kb.name}</div>
          <p className="mt-0.5 break-words text-xs text-gray-500">
            文档数：{kb.document_count}
            {kb.total_chunks ? ` · ${kb.total_chunks} 片段` : ""} · ID:{" "}
            <span className="break-all font-mono">{kb.id}</span>
            {kb.embedding_model ? (
              <>
                {" · embedding："}
                <span className="font-mono">{kb.embedding_model}</span>
              </>
            ) : null}
          </p>
          {kb.description ? (
            <p className="mt-2 text-sm text-gray-600">{kb.description}</p>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="编辑"
            onClick={onEdit}
            className="rounded-md p-2 text-gray-400 hover:bg-orange-50 hover:text-orange-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="删除知识库"
            onClick={onDelete}
            className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {loadingDocs ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载文档列表…
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
              暂无已入库文档
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100">
              {documents.map((doc) => {
                const isDeleting = deletingDocId === doc.id;
                return (
                  <li
                    key={doc.id}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-gray-800" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span>{doc.chunk_count} 片段</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{formatTime(doc.created_at)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      title="删除该文档"
                      disabled={isDeleting}
                      onClick={() => onRequestDeleteDoc(doc)}
                      className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
