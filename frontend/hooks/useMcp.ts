"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiHeaders, apiJsonHeaders, parseApiError } from "@/lib/api";
import { toast } from "sonner";
import type { McpServer } from "@/types/mcp";

export function useMcp(token: string | null) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
  });
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!res.ok) throw new Error(await parseApiError(res));
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
      if (!res.ok) throw new Error(await parseApiError(res));
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
      if (!res.ok) throw new Error(await parseApiError(res));
      setServers((prev) => prev.filter((s) => s.id !== deleteId));
      setDeleteId(null);
      toast.success("MCP 服务已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleTools = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return {
    servers,
    loading,
    error,
    deleteId,
    setDeleteId,
    isDeleting,
    showAddForm,
    setShowAddForm,
    isSubmitting,
    formData,
    setFormData,
    refreshingId,
    expandedTools,
    handleAddSubmit,
    handleRefresh,
    confirmDelete,
    toggleTools,
  };
}
