"use client";

import { Search, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { KnowledgeBase, SearchResult } from "@/types/knowledge";

interface KnowledgeSearchPanelProps {
  kbs: KnowledgeBase[];
  searchKbId: string;
  setSearchKbId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchTopK: number;
  setSearchTopK: (n: number) => void;
  searchResults: SearchResult[];
  searching: boolean;
  hasSearched: boolean;
  lastSearchedKbId: string;
  onSearch: () => void;
}

const TOP_K_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export function KnowledgeSearchPanel({
  kbs,
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
  onSearch,
}: KnowledgeSearchPanelProps) {
  const selectedKb = kbs.find((k) => k.id === searchKbId);
  const lastKb = kbs.find((k) => k.id === lastSearchedKbId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  const disabled = searching || !searchKbId || !searchQuery.trim();

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-sm"
    >
      <h3 className="text-sm font-medium text-gray-900">检索测试</h3>
      <p className="mt-1 text-xs text-gray-500">
        手动验证知识库召回效果，调用与对话工具相同的语义检索逻辑。
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
        <div className="min-w-0">
          <label className="text-xs text-gray-500">知识库</label>
          <Select
            className="mt-1"
            value={searchKbId}
            onValueChange={setSearchKbId}
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
        <div className="min-w-0">
          <label className="text-xs text-gray-500">返回片段数 top_k</label>
          <Select
            className="mt-1"
            value={String(searchTopK)}
            onValueChange={(v) => setSearchTopK(Number(v) || 5)}
            options={TOP_K_OPTIONS}
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {searching ? "检索中…" : "检索"}
        </button>
      </div>

      <div className="mt-3">
        <label className="text-xs text-gray-500">查询语句</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="例如：四逆汤的组成与适应症"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {selectedKb?.embedding_model ? (
        <p className="mt-2 text-xs text-gray-500">
          当前知识库 embedding 模型：
          <span className="ml-1 font-mono text-gray-700">
            {selectedKb.embedding_provider
              ? `${selectedKb.embedding_provider} / `
              : ""}
            {selectedKb.embedding_model}
          </span>
          {selectedKb.embedding_dim ? `（${selectedKb.embedding_dim} 维）` : ""}
        </p>
      ) : null}

      {hasSearched && !searching && searchResults.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500">
          未召回任何片段，可尝试换个表述或调高 top_k。
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="mb-2 text-xs text-gray-500">
            检索结果（{searchResults.length}）
            {lastKb ? ` · 来自「${lastKb.name}」` : ""}
          </div>
          <ol className="space-y-3">
            {searchResults.map((r, i) => (
              <li
                key={`${r.source}-${i}`}
                className="rounded-lg border border-gray-200 bg-gray-50/40 p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span className="truncate font-mono">
                    #{i + 1} · {r.source}
                  </span>
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 font-mono text-[10px] text-orange-700">
                    score {r.score.toFixed(4)}
                  </span>
                </div>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-gray-700">
                  {r.content}
                </pre>
              </li>
            ))}
          </ol>
        </div>
      )}
    </form>
  );
}
