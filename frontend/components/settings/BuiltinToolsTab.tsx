"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { TOOL_LABEL_ZH } from "@/lib/tool-labels";
import { Box, CheckCircle2 } from "lucide-react";

export function BuiltinToolsTab() {
  const { token } = useAuth();
  const [tools, setTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    const fetchTools = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/agents/tools`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("获取工具列表失败");
        const data = await res.json();
        if (mounted) {
          const allTools: string[] = data.tools || [];
          // 只保留非 mcp_ 前缀的，即内置工具
          setTools(allTools.filter((t) => !t.startsWith("mcp_")));
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchTools();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
        加载失败: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">内置工具</h2>
        <p className="mt-1 text-sm text-gray-500">
          系统核心功能所依赖的内置工具集，不可修改或删除。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tools.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
            暂无内置工具
          </div>
        ) : (
          tools.map((toolName) => (
            <div
              key={toolName}
              className="flex flex-col justify-between rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <Box className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {TOOL_LABEL_ZH[toolName] || toolName}
                      </h3>
                      <p className="font-mono text-xs text-gray-400">
                        {toolName}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {toolName === "search_tcm_knowledge"
                    ? "对中医知识库进行语义向量检索，获取相关参考。"
                    : toolName === "formula_lookup"
                    ? "按名称查询方剂的组成、功效与主治。"
                    : toolName === "recommend_formulas"
                    ? "根据症状和主诉推荐相关的中医药方剂。"
                    : toolName === "searx_web_search"
                    ? "通过 SearXNG 进行公网网页检索，获取最新资讯。"
                    : "系统内置工具集。"}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                已启用
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
