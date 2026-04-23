"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Plus, Edit2, Trash2, Bot, Star, Save, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { displayToolNameZh } from "@/lib/tool-labels";

type Agent = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  tool_names: string[];
};

export function AgentsTab() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);

  // 删除
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 编辑/创建状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_prompt: "",
    tool_names: [] as string[],
  });

  const fetchData = async () => {
    if (!token) return;
    try {
      const [agentsRes, toolsRes] = await Promise.all([
        fetch(`${API_BASE}/api/agents`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/agents/tools`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!agentsRes.ok || !toolsRes.ok) throw new Error("获取数据失败");
      const [agentsData, toolsData] = await Promise.all([
        agentsRes.json(),
        toolsRes.json(),
      ]);
      setAgents(agentsData.agents || []);
      setAvailableTools(toolsData.tools || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const stored = localStorage.getItem("tcm_default_agent_id");
    if (stored) setDefaultAgentId(stored);
  }, [token]);

  const handleSetDefault = (id: string | null) => {
    if (id) {
      localStorage.setItem("tcm_default_agent_id", id);
    } else {
      localStorage.removeItem("tcm_default_agent_id");
    }
    setDefaultAgentId(id);
  };

  const handleStartCreate = () => {
    setEditingId("new");
    setFormData({
      name: "",
      description: "",
      system_prompt: "",
      tool_names: [],
    });
  };

  const handleStartEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setFormData({
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt,
      tool_names: agent.tool_names,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const toggleTool = (toolName: string) => {
    setFormData((prev) => ({
      ...prev,
      tool_names: prev.tool_names.includes(toolName)
        ? prev.tool_names.filter((t) => t !== toolName)
        : [...prev.tool_names, toolName],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formData.name.trim()) return;

    setIsSubmitting(true);
    const isNew = editingId === "new";
    const url = isNew
      ? `${API_BASE}/api/agents`
      : `${API_BASE}/api/agents/${editingId}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          system_prompt: formData.system_prompt.trim(),
          tool_names: formData.tool_names,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "保存失败");
      }

      await fetchData();
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "删除失败");
      }
      setAgents((prev) => prev.filter((a) => a.id !== deleteId));
      if (defaultAgentId === deleteId) handleSetDefault(null);
      setDeleteId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
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
        title="删除 Agent"
        description="确定要删除该 Agent 吗？此操作无法撤销。"
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        pending={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => !isDeleting && setDeleteId(null)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agent 管理</h2>
          <p className="mt-1 text-sm text-gray-500">
            自定义系统提示词和绑定的工具集，创建多用途的 AI 助手。
          </p>
        </div>
        {editingId === null && (
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            创建 Agent
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          加载失败: {error}
        </div>
      )}

      {/* Editor Form */}
      {editingId !== null && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-orange-200 bg-orange-50/30 p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between text-sm font-medium text-gray-900">
            <span>{editingId === "new" ? "创建新 Agent" : "编辑 Agent"}</span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                  placeholder="例如: 中医知识库助手"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">说明</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                  placeholder="用于搜索文献与方剂..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">系统提示词 (System Prompt)</label>
              <textarea
                className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                placeholder="留空则使用系统默认提示词..."
                rows={3}
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">绑定工具</label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {availableTools.map((toolName) => (
                  <label
                    key={toolName}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                      formData.tool_names.includes(toolName)
                        ? "border-orange-400 bg-orange-50/50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      checked={formData.tool_names.includes(toolName)}
                      onChange={() => toggleTool(toolName)}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {displayToolNameZh(toolName)}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">
                        {toolName}
                      </span>
                    </div>
                  </label>
                ))}
                {availableTools.length === 0 && (
                  <div className="col-span-full py-4 text-center text-xs text-gray-500">
                    暂无可绑定工具
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="grid gap-4">
        {editingId === null && agents.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
            <Bot className="mb-3 h-8 w-8 text-gray-300" />
            <p>暂无自定义 Agent</p>
            <p className="mt-1 text-xs">点击右上角创建新的智能助手</p>
          </div>
        ) : (
          agents.map((agent) => {
            if (agent.id === editingId) return null; // 编辑中不显示卡片

            const isDefault = defaultAgentId === agent.id;

            return (
              <div
                key={agent.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${
                  isDefault ? "border-orange-300 ring-1 ring-orange-100" : "border-[#e5e5e5]"
                }`}
              >
                <div className="flex items-start justify-between p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isDefault ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                        {isDefault && (
                          <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                            <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                            默认选用
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {agent.description || "暂无说明"}
                      </p>

                      <div className="mt-3">
                        <div className="text-[11px] font-medium text-gray-400">绑定工具</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {agent.tool_names.length > 0 ? (
                            agent.tool_names.map((t) => (
                              <span
                                key={t}
                                className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                                title={t}
                              >
                                {displayToolNameZh(t)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs italic text-gray-400">无</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSetDefault(isDefault ? null : agent.id)}
                      title={isDefault ? "取消默认" : "设为默认"}
                      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                        isDefault
                          ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <Star className={`h-4 w-4 ${isDefault ? "fill-orange-500" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleStartEdit(agent)}
                      title="编辑"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(agent.id)}
                      title="删除"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
