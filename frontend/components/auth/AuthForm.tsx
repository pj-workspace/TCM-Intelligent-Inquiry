"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Sun } from "lucide-react";

type AuthFormProps = {
  onAuthenticated: () => void;
  /** 为 true 时不展示顶部标题（例如在弹窗里由外层提供标题） */
  compact?: boolean;
};

export function AuthForm({ onAuthenticated, compact }: AuthFormProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      {!compact && (
        <div className="flex items-center justify-center gap-2 mb-8 text-2xl font-serif text-[#1a1a1a]">
          <Sun className="w-8 h-8 text-orange-500" />
          <span>TCM 智能问诊</span>
        </div>
      )}

      <div className="flex rounded-xl bg-[#f4f4f5] p-1 mb-6">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === "login"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError(null);
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === "register"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          注册
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            用户名
          </label>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] outline-none focus:border-gray-400 focus:bg-white transition-colors"
            placeholder={mode === "register" ? "至少 2 个字符" : ""}
            required
            minLength={mode === "register" ? 2 : 1}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            密码
          </label>
          <input
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] outline-none focus:border-gray-400 focus:bg-white transition-colors"
            placeholder={mode === "register" ? "至少 6 位" : ""}
            required
            minLength={mode === "register" ? 6 : 1}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 rounded-xl bg-[#1a1a1a] text-white text-[15px] font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {pending ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>
    </div>
  );
}
