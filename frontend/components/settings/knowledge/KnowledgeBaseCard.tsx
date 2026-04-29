"use client";

import { Pencil, Trash2, Database } from "lucide-react";
import type { KnowledgeBase } from "@/types/knowledge";

interface KnowledgeBaseCardProps {
  kb: KnowledgeBase;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function KnowledgeBaseCard({
  kb,
  onOpen,
  onEdit,
  onDelete,
}: KnowledgeBaseCardProps) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-sm transition-all hover:border-orange-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 items-start gap-3 text-left focus:outline-none"
        >
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
              {kb.name}
            </h4>
            <p className="mt-1 break-words text-xs text-gray-500">
              {kb.document_count} 篇文档
              {kb.total_chunks ? ` · ${kb.total_chunks} 片段` : ""}
            </p>
          </div>
        </button>
        
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
      
      {kb.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-gray-600">
          {kb.description}
        </p>
      ) : null}
      
      {kb.embedding_model ? (
        <div className="mt-4 mt-auto pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span className="font-mono truncate">{kb.embedding_model}</span>
          <span className="shrink-0 font-mono text-[10px]">{kb.id.slice(0,8)}</span>
        </div>
      ) : null}
    </div>
  );
}
