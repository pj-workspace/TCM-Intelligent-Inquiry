"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, FileJson } from "lucide-react";

export interface McpFormData {
  name: string;
  url: string;
  description: string;
  authToken: string;
}

interface McpAddFormProps {
  formData: McpFormData;
  setFormData: React.Dispatch<React.SetStateAction<McpFormData>>;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

// ── JSON 配置解析 ──────────────────────────────────────────────────────────────
// 支持两种格式：
//   1. 标准 mcpServers 格式（Cursor / Claude Desktop 导出）
//      { "mcpServers": { "服务名": { "url": "...", "headers": { "Authorization": "..." } } } }
//   2. 单条记录
//      { "url": "...", "headers": { "Authorization": "..." } }
function parseMcpJson(text: string): Partial<McpFormData> | null {
  try {
    const obj = JSON.parse(text.trim()) as Record<string, unknown>;

    // 格式一：mcpServers
    if (obj.mcpServers && typeof obj.mcpServers === "object") {
      const entries = Object.entries(obj.mcpServers as Record<string, unknown>);
      if (entries.length === 0) return null;
      const [name, conf] = entries[0];
      const c = conf as Record<string, unknown>;
      const authHeader =
        typeof c.headers === "object" && c.headers !== null
          ? ((c.headers as Record<string, string>)["Authorization"] ?? "")
          : "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;
      return {
        name: String(name),
        url: typeof c.url === "string" ? c.url : "",
        description: typeof c.description === "string" ? c.description : "",
        authToken: token,
      };
    }

    // 格式二：单条
    if (typeof obj.url === "string") {
      const authHeader =
        typeof obj.headers === "object" && obj.headers !== null
          ? ((obj.headers as Record<string, string>)["Authorization"] ?? "")
          : "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;
      return {
        url: obj.url,
        authToken: token,
        description:
          typeof obj.description === "string" ? obj.description : "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function McpAddForm({
  formData,
  setFormData,
  isSubmitting,
  onSubmit,
  onCancel,
}: McpAddFormProps) {
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  const handleJsonPaste = (value: string) => {
    setJsonText(value);
    if (!value.trim()) {
      setJsonError("");
      return;
    }
    const parsed = parseMcpJson(value);
    if (!parsed) {
      setJsonError("无法解析：请确认为标准 MCP JSON 配置（支持 mcpServers 格式或单条 {url, headers}）");
      return;
    }
    setJsonError("");
    setFormData((prev) => ({
      ...prev,
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.url ? { url: parsed.url } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.authToken !== undefined ? { authToken: parsed.authToken } : {}),
    }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 text-sm font-medium text-gray-900">添加新服务</div>

      {/* JSON 导入区 */}
      <div className="mb-4 rounded-lg border border-dashed border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          <FileJson className="h-4 w-4 text-orange-400" />
          从 JSON 配置导入（粘贴 Cursor / Claude Desktop 格式）
          {showJson ? (
            <ChevronUp className="ml-auto h-4 w-4" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4" />
          )}
        </button>
        {showJson && (
          <div className="border-t border-gray-200 px-4 pb-4 pt-3">
            <textarea
              rows={5}
              className={`w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus:ring-1 ${
                jsonError
                  ? "border-red-300 focus:border-red-400 focus:ring-red-300"
                  : "border-gray-300 focus:border-orange-400 focus:ring-orange-400"
              }`}
              placeholder={`{\n  "mcpServers": {\n    "my-server": {\n      "url": "https://example.com/mcp",\n      "headers": { "Authorization": "Bearer xxx" }\n    }\n  }\n}`}
              value={jsonText}
              onChange={(e) => handleJsonPaste(e.target.value)}
            />
            {jsonError && (
              <p className="mt-1 text-xs text-red-600">{jsonError}</p>
            )}
            {!jsonError && jsonText.trim() && (
              <p className="mt-1 text-xs text-green-600">✓ 已自动填入下方字段</p>
            )}
          </div>
        )}
      </div>

      {/* 手动填写区 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            服务名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            placeholder="例如：SearchServer"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            placeholder="https://example.com/mcp"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Bearer Token（可选）
          </label>
          <input
            type="password"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            placeholder="留空则不带 Authorization 头"
            value={formData.authToken}
            onChange={(e) =>
              setFormData({ ...formData, authToken: e.target.value })
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">说明（可选）</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            placeholder="提供搜索能力的外部服务…"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
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
          {isSubmitting ? "连接探测中，请稍候…" : "保存并探测"}
        </button>
      </div>
    </form>
  );
}
