"use client";

import { Save, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { displayToolNameZh } from "@/lib/tool-labels";
import type { AgentFormData, KnowledgeBaseLite } from "@/types/agent";

interface AgentFormProps {
  editingId: string;
  formData: AgentFormData;
  setFormData: React.Dispatch<React.SetStateAction<AgentFormData>>;
  availableTools: string[];
  knowledgeBases: KnowledgeBaseLite[];
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  toggleTool: (toolName: string) => void;
}

export function AgentForm({
  editingId,
  formData,
  setFormData,
  availableTools,
  knowledgeBases,
  isSubmitting,
  onSubmit,
  onCancel,
  toggleTool,
}: AgentFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-orange-200 bg-orange-50/30 p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between text-sm font-medium text-gray-900">
        <span>{editingId === "new" ? "创建新 Agent" : "编辑 Agent"}</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
              名称 <span className="text-red-500">*</span>
            </label>
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
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            系统提示词 (System Prompt)
          </label>
          <textarea
            className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            placeholder="留空则使用系统默认提示词..."
            rows={3}
            value={formData.system_prompt}
            onChange={(e) =>
              setFormData({ ...formData, system_prompt: e.target.value })
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            默认知识库（search_tcm_knowledge 未指定 kb_id 时使用）
          </label>
          <Select
            value={formData.default_kb_id}
            onValueChange={(v) =>
              setFormData((prev) => ({ ...prev, default_kb_id: v }))
            }
            placeholder="选择默认知识库"
            options={[
              {
                value: "",
                label: "不指定（按系统默认或您名下第一个知识库）",
              },
              ...knowledgeBases.map((k) => ({ value: k.id, label: k.name })),
            ]}
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
          <Save className="h-4 w-4" />
          {isSubmitting ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}
