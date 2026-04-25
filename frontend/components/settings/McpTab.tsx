"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiHeaders, apiJsonHeaders, parseApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Plus, Trash2, RefreshCw, Plug, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type McpServer = {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  tool_names: string[];
  last_probe_at: string | null;
  last_probe_error: string | null;
};

export function McpTab() {
  const { token } = useAuth();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 删除
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 添加表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", url: "", description: "" });

  // 刷新状态
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // 折叠状态 (serverId -> boolean)
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const toggleTools = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchServers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/mcp`, {
        headers: apiHeaders(token),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setServers(data.servers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchServers();
  }, [token]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formData.name.trim() || !formData.url.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/mcp`, {
        method: "POST",
        headers: apiJsonHeaders(token),
        body: JSON.stringify({
          name: formData.name.trim(),
          url: formData.url.trim(),
          description: formData.description.trim(),
          enabled: true,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      await fetchServers();
      setShowAddForm(false);
      setFormData({ name: "", url: "", description: "" });
      toast.success("MCP 服务已添加");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "添加失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async (id: string) => {
    if (!token || refreshingId) return;
    setRefreshingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/${id}/refresh`, {
        method: "POST",
        headers: apiHeaders(token),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      await fetchServers();
      toast.success("已重新探测并刷新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setRefreshingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/mcp/${deleteId}`, {
        method: "DELETE",
        headers: apiHeaders(token),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      setServers((prev) => prev.filter((s) => s.id !== deleteId));
      setDeleteId(null);
      toast.success("MCP 服务已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeleting(false);
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
        title="删除 MCP 服务"
        description="确定要删除该 MCP 服务吗？此操作无法撤销。"
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        pending={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => !isDeleting && setDeleteId(null)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">MCP 服务</h2>
          <p className="mt-1 text-sm text-gray-500">
            连接外部模型上下文协议（MCP）服务器，动态扩展大模型能力。
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            添加服务
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          加载失败: {error}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 text-sm font-medium text-gray-900">添加新服务</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">服务名称 <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                placeholder="例如: SearchServer"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                placeholder="http://localhost:3100"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-gray-700">说明（可选）</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                placeholder="提供搜索能力的本地服务..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              保存并探测
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="grid gap-4">
        {!showAddForm && servers.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
            <Plug className="mb-3 h-8 w-8 text-gray-300" />
            <p>暂无 MCP 服务</p>
            <p className="mt-1 text-xs">点击右上角添加新服务并连接远端工具</p>
          </div>
        ) : (
          servers.map((server) => {
            const isExpanded = expandedTools[server.id];
            const isRef = refreshingId === server.id;

            return (
              <div
                key={server.id}
                className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between border-b border-gray-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Plug className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{server.name}</h3>
                        {server.enabled ? (
                          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            启用
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            禁用
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-gray-500">{server.url}</p>
                      {server.description && (
                        <p className="mt-1.5 text-sm text-gray-600">{server.description}</p>
                      )}
                      
                      {/* Probe Status */}
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        {server.last_probe_error ? (
                          <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                            </span>
                            探测失败：{server.last_probe_error}
                          </div>
                        ) : server.last_probe_at ? (
                          <span className="text-gray-400">
                            上次成功探测: {new Date(server.last_probe_at).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">从未探测</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRefresh(server.id)}
                      disabled={isRef}
                      title="刷新工具"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRef ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => setDeleteId(server.id)}
                      title="删除"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Tools Collapse */}
                <div className="bg-[#fafaf8] px-5 py-3">
                  <button
                    onClick={() => toggleTools(server.id)}
                    className="flex w-full items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>已发现 {server.tool_names.length} 个工具</span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && server.tool_names.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pb-1">
                      {server.tool_names.map((t) => (
                        <span
                          key={t}
                          className="rounded border border-[#e5e5e5] bg-white px-2 py-1 font-mono text-[11px] text-gray-600 shadow-sm"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {isExpanded && server.tool_names.length === 0 && (
                    <div className="mt-3 pb-1 text-xs text-gray-400">
                      未能从服务端点发现可用工具。
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
