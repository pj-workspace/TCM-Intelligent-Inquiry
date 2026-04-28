"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiHeaders, apiJsonHeaders, parseApiError } from "@/lib/api";
import { toast } from "sonner";
import type { Agent, AgentFormData, KnowledgeBaseLite } from "@/types/agent";

const INITIAL_FORM: AgentFormData = {
  name: "",
  description: "",
  system_prompt: "",
  tool_names: [],
  default_kb_id: "",
};

export function useAgents(token: string | null) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AgentFormData>(INITIAL_FORM);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [agentsRes, toolsRes, kbRes] = await Promise.all([
        fetch(`${API_BASE}/api/agents`, { headers: apiHeaders(token) }),
        fetch(`${API_BASE}/api/agents/tools`, { headers: apiHeaders(token) }),
        fetch(`${API_BASE}/api/knowledge`, { headers: apiHeaders(token) }),
      ]);
      if (!agentsRes.ok || !toolsRes.ok) throw new Error("获取数据失败");
      const [agentsData, toolsData] = await Promise.all([
        agentsRes.json(),
        toolsRes.json(),
      ]);
      setAgents(agentsData.agents || []);
      setAvailableTools(toolsData.tools || []);
      if (kbRes.ok) {
        const kbJson = (await kbRes.json()) as {
          knowledge_bases?: { id: string; name: string }[];
        };
        setKnowledgeBases(
          (kbJson.knowledge_bases || []).map((k) => ({ id: k.id, name: k.name }))
        );
      } else {
        setKnowledgeBases([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
    const stored = localStorage.getItem("tcm_default_agent_id");
    if (stored) setDefaultAgentId(stored);
  }, [token, fetchData]);

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
    setFormData(INITIAL_FORM);
  };

  const handleStartEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setFormData({
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt,
      tool_names: agent.tool_names,
      default_kb_id: agent.default_kb_id?.trim() || "",
    });
  };

  const handleCancelEdit = () => setEditingId(null);

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
        headers: apiJsonHeaders(token),
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          system_prompt: formData.system_prompt.trim(),
          tool_names: formData.tool_names,
          default_kb_id: formData.default_kb_id.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      await fetchData();
      setEditingId(null);
      toast.success(isNew ? "Agent 已创建" : "已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
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
        headers: apiHeaders(token),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      if (defaultAgentId === deleteId) handleSetDefault(null);
      setDeleteId(null);
      await fetchData();
      toast.success("已删除该 Agent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    agents,
    availableTools,
    knowledgeBases,
    loading,
    error,
    defaultAgentId,
    deleteId,
    setDeleteId,
    isDeleting,
    editingId,
    isSubmitting,
    formData,
    setFormData,
    handleSetDefault,
    handleStartCreate,
    handleStartEdit,
    handleCancelEdit,
    toggleTool,
    handleSubmit,
    confirmDelete,
  };
}
