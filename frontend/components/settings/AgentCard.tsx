"use client";

import { Bot, Star, Edit2, Trash2 } from "lucide-react";
import { displayToolNameZh } from "@/lib/tool-labels";
import type { Agent, KnowledgeBaseLite } from "@/types/agent";

interface AgentCardProps {
  agent: Agent;
  isDefault: boolean;
  knowledgeBases: KnowledgeBaseLite[];
  onSetDefault: (id: string | null) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
}

export function AgentCard({
  agent,
  isDefault,
  knowledgeBases,
  onSetDefault,
  onEdit,
  onDelete,
}: AgentCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${
        isDefault
          ? "border-orange-300 ring-1 ring-orange-100"
          : "border-[#e5e5e5]"
      }`}
    >
      <div className="flex items-start justify-between p-5">
        <div className="flex items-start gap-4">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDefault
                ? "bg-orange-100 text-orange-600"
                : "bg-gray-100 text-gray-600"
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

            <div className="mt-3">
              <div className="text-[11px] font-medium text-gray-400">默认知识库</div>
              <p className="mt-1 text-xs text-gray-600">
                {agent.default_kb_id ? (
                  <>
                    {knowledgeBases.find((k) => k.id === agent.default_kb_id)
                      ?.name ?? "（未在列表中）"}{" "}
                    <span className="font-mono text-gray-400">
                      {agent.default_kb_id}
                    </span>
                  </>
                ) : (
                  <span className="italic text-gray-400">未指定</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetDefault(isDefault ? null : agent.id)}
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
            onClick={() => onEdit(agent)}
            title="编辑"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            title="删除"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
