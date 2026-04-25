"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { ArrowLeft, Box, Plug, Bot, Database } from "lucide-react";
import { BuiltinToolsTab } from "@/components/settings/BuiltinToolsTab";
import { McpTab } from "@/components/settings/McpTab";
import { AgentsTab } from "@/components/settings/AgentsTab";
import { KnowledgeTab } from "@/components/settings/KnowledgeTab";

type TabId = "builtin" | "mcp" | "knowledge" | "agents";

export default function SettingsPage() {
  const { loading, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("builtin");

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  if (loading || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fdfdfc]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[#fdfdfc] text-gray-800">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b border-[#e5e5e5] bg-white/80 px-4 backdrop-blur-sm md:px-6">
        <Link
          href="/"
          className="mr-4 flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回对话
        </Link>
        <h1 className="text-base font-semibold">工具与 Agent 设置</h1>
      </header>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <nav className="w-56 shrink-0 border-r border-[#e5e5e5] bg-[#fbfaf7] p-4">
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab("builtin")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "builtin"
                  ? "bg-white text-orange-600 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Box className="h-4 w-4" />
              内置工具
            </button>
            <button
              onClick={() => setActiveTab("mcp")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "mcp"
                  ? "bg-white text-orange-600 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Plug className="h-4 w-4" />
              MCP 服务
            </button>
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "knowledge"
                  ? "bg-white text-orange-600 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Database className="h-4 w-4" />
              知识库
            </button>
            <button
              onClick={() => setActiveTab("agents")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "agents"
                  ? "bg-white text-orange-600 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Bot className="h-4 w-4" />
              Agent 管理
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#fdfdfc] p-6 md:p-8">
          <div className="mx-auto max-w-4xl">
            {activeTab === "builtin" && <BuiltinToolsTab />}
            {activeTab === "mcp" && <McpTab />}
            {activeTab === "knowledge" && <KnowledgeTab />}
            {activeTab === "agents" && <AgentsTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
