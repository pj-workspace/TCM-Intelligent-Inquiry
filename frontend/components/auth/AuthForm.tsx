"use client";

import { useEffect, useRef, useState, Suspense, forwardRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Sun } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, parseApiError } from "@/lib/api";
import { useCooldownTimer } from "@/hooks/useCooldownTimer";
import { AnimatePresence, motion } from "framer-motion";
import { uiModalBackdrop, uiModalPanel } from "@/lib/ui-motion";

type AuthFormProps = {
  onAuthenticated: () => void;
  compact?: boolean;
};

function OAuthIconGitee() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>Gitee</title>
      <path
        fill="currentColor"
        d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296Z"
      />
    </svg>
  );
}

function OAuthIconGitHub() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>GitHub</title>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const ThirdFlowModal = forwardRef<
  HTMLDivElement,
  {
    provider: string;
    flowId: string;
    onClose: () => void;
    finishLogin: (token: string) => void | Promise<void>;
  }
>(function ThirdFlowModal({ provider, flowId, onClose, finishLogin }, ref) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [needPw, setNeedPw] = useState(false);
  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const sendCd = useCooldownTimer();

  const sendCode = async () => {
    setErr(null);
    if (!email.trim()) {
      setErr("请输入邮箱");
      return;
    }
    if (sendCd.left > 0 || sendBusy) return;
    setSendBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/code/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErr(msg);
        toast.error(msg);
        return;
      }
      toast.success("验证码已发送，请查收邮箱");
      sendCd.start(60);
      setHint("请在邮箱中查收 6 位验证码");
    } finally {
      setSendBusy(false);
    }
  };

  const submitComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const body: Record<string, string | undefined> = {
        flowId,
        email: email.trim(),
        code,
        password: password || undefined,
        nickname: nickname || undefined,
      };
      const res = await fetch(
        `${API_BASE}/api/auth/oauth/${provider}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const dataRaw = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (dataRaw && typeof dataRaw === "object" && "message" in dataRaw
            ? String((dataRaw as { message?: string }).message)
            : null) || (await parseApiError(res));
        throw new Error(msg);
      }
      const data = dataRaw as {
        need_password?: boolean;
        suggest_nickname?: string;
        access_token?: string;
      };
      if (data.need_password) {
        setNeedPw(true);
        if (data.suggest_nickname) setNickname(data.suggest_nickname);
        setPending(false);
        return;
      }
      const { access_token: at } = data;
      if (!at) throw new Error("登录失败");
      await finishLogin(at);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "登录失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.div
      ref={ref}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      {...uiModalBackdrop}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#e5e5e5]"
        onClick={(e) => e.stopPropagation()}
        {...uiModalPanel}
      >
        <h2 className="text-lg font-semibold mb-1">绑定邮箱</h2>
        <p className="text-sm text-gray-500 mb-4">
          请在下方填写邮箱并完成验证，以继续使用 {provider} 登录。
        </p>
        <form onSubmit={submitComplete} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">邮箱</label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="六位验证码"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              minLength={6}
              maxLength={8}
            />
            <button
              type="button"
              disabled={sendCd.left > 0 || sendBusy}
              onClick={() => void sendCode()}
              className="shrink-0 rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm whitespace-nowrap disabled:opacity-50"
            >
              {sendBusy
                ? "发送中…"
                : sendCd.left > 0
                  ? `${sendCd.left}s 后可重发`
                  : "发送验证码"}
            </button>
          </div>
          {needPw && (
            <>
              <div>
                <label className="text-xs text-gray-500">设置密码（至少 6 位）</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required={needPw}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">昵称（可选）</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </>
          )}
          {hint && !err && (
            <p className="text-sm text-green-700">{hint}</p>
          )}
          {err && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-2 py-1">{err}</p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 py-2 rounded-xl border text-sm"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2 rounded-xl bg-[#1a1a1a] text-white text-sm disabled:opacity-50"
            >
              {pending ? "提交中…" : "完成绑定"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
});

ThirdFlowModal.displayName = "ThirdFlowModal";

function AuthFormInner({ onAuthenticated, compact }: AuthFormProps) {
  const { login, register, loginWithToken, loginWithEmailCode } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [emailReg, setEmailReg] = useState("");
  const [regVerifyCode, setRegVerifyCode] = useState("");
  const registerCd = useCooldownTimer();
  const forgotSendCd = useCooldownTimer();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registerSendBusy, setRegisterSendBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [forgotStep, setForgotStep] = useState<"email" | "reset">("email");
  const [forgotMailBusy, setForgotMailBusy] = useState(false);
  const [forgotResetBusy, setForgotResetBusy] = useState(false);
  /** 登录：密码方式 vs 邮箱验证码方式 */
  const [loginMethod, setLoginMethod] = useState<"password" | "email_code">("password");
  const [emailLogin, setEmailLogin] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const loginCd = useCooldownTimer();
  const [loginSendBusy, setLoginSendBusy] = useState(false);
  const [thirdModal, setThirdModal] = useState<{
    flowId: string;
    provider: string;
  } | null>(null);
  const oauthExchangeOnce = useRef(false);

  /** OAuth landing: ?code= or ?thirdFlow=&provider=&oauth_error= */
  useEffect(() => {
    const oauthErr = searchParams.get("oauth_error");
    if (oauthErr) setError(decodeURIComponent(oauthErr));

    const code = searchParams.get("code");
    const tf = searchParams.get("thirdFlow");
    const pv = searchParams.get("provider");

    if (tf && pv) {
      setThirdModal({ flowId: tf, provider: pv.toLowerCase() });
      return;
    }

    if (code && !tf && !oauthExchangeOnce.current) {
      oauthExchangeOnce.current = true;
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/oauth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          if (!res.ok) {
            setError(await parseApiError(res));
            return;
          }
          const data = (await res.json()) as { access_token: string };
          await loginWithToken(data.access_token);
          onAuthenticated();
        } catch {
          setError("OAuth 登录失败");
        }
      })();
    }
  }, [searchParams, loginWithToken, onAuthenticated]);

  const startOAuth = async (p: "github" | "gitee") => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/oauth/${p}/authorize`);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { authorize_url: string };
      window.location.href = data.authorize_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法发起 OAuth");
    }
  };

  const sendRegisterCode = async () => {
    setError(null);
    const em = emailReg.trim();
    if (!em) {
      setError("请先填写邮箱");
      toast.error("请先填写邮箱");
      return;
    }
    if (registerCd.left > 0 || registerSendBusy || pending) return;
    setRegisterSendBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/code/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("验证码已发送，请查收邮箱");
      registerCd.start(60);
    } finally {
      setRegisterSendBusy(false);
    }
  };

  const sendLoginEmailCode = async () => {
    setError(null);
    const em = emailLogin.trim();
    if (!em) {
      toast.error("请先填写邮箱");
      return;
    }
    if (loginCd.left > 0 || loginSendBusy || pending) return;
    setLoginSendBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/code/send-email-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("验证码已发送，请查收邮箱");
      loginCd.start(60);
    } finally {
      setLoginSendBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        if (loginMethod === "email_code") {
          const em = emailLogin.trim();
          const c = loginOtpCode.trim().replace(/\D/g, "").slice(0, 6);
          if (!em) {
            setError("请填写邮箱");
            setPending(false);
            return;
          }
          if (!/^[0-9]{6}$/.test(c)) {
            setError("请输入邮件中的 6 位数字验证码");
            setPending(false);
            return;
          }
          await loginWithEmailCode(em, c);
        } else {
          await login(username.trim(), password);
        }
      } else {
        const em = emailReg.trim();
        const vc = regVerifyCode.trim();
        if (!em) {
          setError("请填写邮箱");
          setPending(false);
          return;
        }
        if (!vc || vc.length < 6) {
          setError("请输入邮件中的 6 位验证码");
          setPending(false);
          return;
        }
        await register(username.trim(), password, em, vc);
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setPending(false);
    }
  };

  const sendForgot = async () => {
    setError(null);
    const em = forgotEmail.trim();
    if (!em) {
      toast.error("请输入账户邮箱");
      return;
    }
    if (forgotSendCd.left > 0 || forgotMailBusy) return;
    setForgotMailBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/code/send-forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("验证码已发送，请查收邮箱");
      forgotSendCd.start(60);
      setForgotStep("reset");
    } finally {
      setForgotMailBusy(false);
    }
  };

  const resendForgotOnly = async () => {
    if (forgotSendCd.left > 0 || forgotMailBusy) return;
    const em = forgotEmail.trim();
    if (!em) {
      toast.error("请输入账户邮箱（可关闭弹窗后从第一步重新填写）");
      return;
    }
    setForgotMailBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/code/send-forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("验证码已重新发送");
      forgotSendCd.start(60);
    } finally {
      setForgotMailBusy(false);
    }
  };

  const resetForgot = async () => {
    setError(null);
    const trimmed = forgotCode.trim();
    if (!trimmed || !/^[0-9]{6}$/.test(trimmed)) {
      const msg = "请输入邮件中的 6 位数字验证码";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (newPw.length < 6) {
      const msg = "新密码至少 6 位";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (forgotResetBusy) return;
    setForgotResetBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: trimmed,
          new_password: newPw,
        }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("密码已重置，请使用新密码登录");
      setShowForgot(false);
      setForgotStep("email");
      setError(null);
    } finally {
      setForgotResetBusy(false);
    }
  };

  return (
    <div className="relative">
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
              ? "bg-white shadow-sm text-gray-900 hover:bg-gray-50/90"
              : "text-gray-500 hover:bg-white/70 hover:text-gray-700"
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setLoginMethod("password");
            setError(null);
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === "register"
              ? "bg-white shadow-sm text-gray-900 hover:bg-gray-50/90"
              : "text-gray-500 hover:bg-white/70 hover:text-gray-700"
          }`}
        >
          注册
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* 验证码登录时在顶部给出返回，避免两套「块状 Tab」并排显得笨重 */}
        {mode === "login" && loginMethod === "email_code" && (
          <div className="flex justify-start">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-orange-700"
              onClick={() => {
                setLoginMethod("password");
                setLoginOtpCode("");
                setError(null);
              }}
            >
              <span aria-hidden>←</span>
              返回密码登录
            </button>
          </div>
        )}

        {(mode === "register" || (mode === "login" && loginMethod === "password")) && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {mode === "login" ? "用户名或邮箱" : "用户名"}
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder={
                mode === "register" ? "至少 2 个字符" : "用户名或邮箱"
              }
              required={
                mode === "register" || (mode === "login" && loginMethod === "password")
              }
              minLength={mode === "register" ? 2 : 1}
            />
          </div>
        )}

        {mode === "register" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                autoComplete="email"
                value={emailReg}
                onChange={(e) => setEmailReg(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] outline-none focus:border-gray-400 focus:bg-white transition-colors"
                placeholder="请输入邮箱"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                验证码
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={regVerifyCode}
                  onChange={(e) => setRegVerifyCode(e.target.value)}
                  className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] tracking-[0.35em]"
                  placeholder="6 位数字"
                  required
                  minLength={6}
                  maxLength={8}
                />
                <button
                  type="button"
                  disabled={registerCd.left > 0 || registerSendBusy || pending}
                  onClick={() => void sendRegisterCode()}
                  className="shrink-0 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-[13px] font-medium whitespace-nowrap text-[#374151] hover:bg-gray-50 disabled:opacity-50"
                >
                  {registerSendBusy
                    ? "发送中…"
                    : registerCd.left > 0
                      ? `${registerCd.left}s 后可重发`
                      : "发送验证码"}
                </button>
              </div>
            </div>
          </>
        )}

        {mode === "login" && loginMethod === "email_code" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">邮箱</label>
              <input
                type="email"
                autoComplete="email"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] outline-none focus:border-gray-400 focus:bg-white transition-colors"
                placeholder="请输入邮箱"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                邮箱验证码
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={loginOtpCode}
                  onChange={(e) =>
                    setLoginOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] tracking-[0.35em]"
                  placeholder="6 位数字"
                  required={mode === "login" && loginMethod === "email_code"}
                  maxLength={6}
                />
                <button
                  type="button"
                  disabled={loginCd.left > 0 || loginSendBusy || pending}
                  onClick={() => void sendLoginEmailCode()}
                  className="shrink-0 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-[13px] font-medium whitespace-nowrap text-[#374151] hover:bg-gray-50 disabled:opacity-50"
                >
                  {loginSendBusy
                    ? "发送中…"
                    : loginCd.left > 0
                      ? `${loginCd.left}s 后可重发`
                      : "发送验证码"}
                </button>
              </div>
            </div>
          </>
        )}

        {(mode === "register" || (mode === "login" && loginMethod === "password")) && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-gray-500">
                {mode === "login" ? "密码" : "设置密码"}
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-xs font-medium text-orange-700 hover:underline"
                  onClick={() => {
                    setShowForgot(true);
                    setError(null);
                  }}
                >
                  忘记密码？
                </button>
              )}
            </div>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] text-[15px] outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder={mode === "register" ? "至少 6 位" : ""}
              required={
                mode === "register" || (mode === "login" && loginMethod === "password")
              }
              minLength={mode === "register" ? 6 : 1}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-orange-700 py-3 text-[15px] font-semibold text-white shadow-sm ring-1 ring-orange-800/30 transition-colors hover:bg-orange-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? "请稍候…" : mode === "register" ? "注册并登录" : "登录"}
        </button>

        {mode === "login" && loginMethod === "password" && (
          <div className="flex flex-wrap justify-center pt-2 text-[13px]">
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-orange-700/95 transition-colors hover:bg-orange-50/90 hover:text-orange-950"
              onClick={() => {
                setLoginMethod("email_code");
                setUsername("");
                setPassword("");
                setError(null);
              }}
            >
              使用邮箱验证码登录
            </button>
          </div>
        )}

        <div className="space-y-3 border-t border-[#eae8e4] pt-5">
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-[#b4b4b9]">
            第三方账号
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => startOAuth("github")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white py-2.5 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#fafafa]"
            >
              <OAuthIconGitHub />
              GitHub
            </button>
            <button
              type="button"
              onClick={() => startOAuth("gitee")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white py-2.5 text-sm font-medium text-[#C71D23] shadow-sm hover:bg-orange-50/50"
            >
              <OAuthIconGitee />
              Gitee
            </button>
          </div>
        </div>
      </form>

      <AnimatePresence mode="sync">
        {showForgot && (
        <motion.div
          key="auth-forgot"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (forgotMailBusy || forgotResetBusy) return;
            setShowForgot(false);
            setForgotStep("email");
            setForgotCode("");
            setNewPw("");
          }}
          {...uiModalBackdrop}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#e5e5e5]"
            onClick={(e) => e.stopPropagation()}
            {...uiModalPanel}
          >
            <h3 className="text-base font-semibold mb-1">忘记密码</h3>
            <p className="text-sm text-gray-500 mb-4">
              {forgotStep === "email"
                ? "输入你在本站注册时使用的邮箱。"
                : "邮件中的验证码 10 分钟内有效，可同时在此设置新密码。"}
            </p>
            {forgotStep === "email" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">注册邮箱</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <button
                  type="button"
                  disabled={forgotSendCd.left > 0 || forgotMailBusy || forgotResetBusy}
                  className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-orange-700"
                  onClick={() => void sendForgot()}
                >
                  {forgotMailBusy
                    ? "发送中…"
                    : forgotSendCd.left > 0
                      ? `${forgotSendCd.left}s 后可重发`
                      : "发送验证码"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="六位验证码"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border px-3 py-2 text-sm tracking-widest"
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value)}
                  minLength={6}
                  maxLength={8}
                />
                <input
                  type="password"
                  placeholder="新密码至少 6 位"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={newPw}
                  minLength={6}
                  onChange={(e) => setNewPw(e.target.value)}
                />
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-[#1a1a1a] text-white text-sm font-medium hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-50"
                  disabled={forgotResetBusy || forgotMailBusy}
                  onClick={() => void resetForgot()}
                >
                  {forgotResetBusy ? "提交中…" : "重置密码"}
                </button>
                <button
                  type="button"
                  disabled={forgotSendCd.left > 0 || forgotMailBusy || forgotResetBusy}
                  className="w-full py-2 text-sm text-orange-700 hover:underline disabled:opacity-40"
                  onClick={() => void resendForgotOnly()}
                >
                  {forgotMailBusy && !forgotResetBusy
                    ? "发送中…"
                    : forgotSendCd.left > 0
                      ? `${forgotSendCd.left}s 后可重新发送`
                      : "重新发送验证码"}
                </button>
              </div>
            )}
            <button
              type="button"
              className="mt-4 w-full py-2.5 text-sm text-gray-600 border rounded-xl hover:bg-gray-50"
              onClick={() => {
                setShowForgot(false);
                setForgotStep("email");
                setForgotCode("");
                setNewPw("");
              }}
            >
              关闭
            </button>
          </motion.div>
        </motion.div>
        )}

        {thirdModal && (
          <ThirdFlowModal
            key={thirdModal.flowId}
            provider={thirdModal.provider}
            flowId={thirdModal.flowId}
            onClose={() => {
              setThirdModal(null);
              router.replace("/login");
            }}
            finishLogin={async (at: string) => {
              await loginWithToken(at);
              setThirdModal(null);
              onAuthenticated();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** useSearchParams 需 Suspense 包裹（Next.js） */
export function AuthForm(props: AuthFormProps) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12 text-gray-500 text-sm">
          加载中…
        </div>
      }
    >
      <AuthFormInner {...props} />
    </Suspense>
  );
}
