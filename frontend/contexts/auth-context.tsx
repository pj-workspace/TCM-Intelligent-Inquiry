"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { API_BASE, TOKEN_KEY, apiJsonHeaders, parseApiError } from "@/lib/api";

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  email_verified: boolean;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  /** 已向该邮箱发送登录验证码后的无密码登录 */
  loginWithEmailCode: (email: string, code: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    email: string,
    emailCode: string,
  ) => Promise<void>;
  loginWithToken: (accessToken: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (accessToken: string) => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: apiJsonHeaders(accessToken),
    });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      return;
    }
    const data = (await res.json()) as {
      id: string;
      username: string;
      email?: string | null;
      email_verified?: boolean;
    };
    setUser({
      id: data.id,
      username: data.username,
      email: data.email ?? null,
      email_verified: data.email_verified ?? false,
    });
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    const t = localStorage.getItem(TOKEN_KEY);
    setToken(t);
    if (t) {
      fetchMe(t).finally(() => {
        if (!cancelled) setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  const login = useCallback(
    async (usernameOrEmail: string, password: string) => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameOrEmail, password }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as {
        access_token: string;
        token_type?: string;
      };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      await fetchMe(data.access_token);
    },
    [fetchMe]
  );

  const loginWithEmailCode = useCallback(
    async (email: string, code: string) => {
      const res = await fetch(`${API_BASE}/api/auth/login-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as {
        access_token: string;
        token_type?: string;
      };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      await fetchMe(data.access_token);
    },
    [fetchMe]
  );

  const loginWithToken = useCallback(
    async (accessToken: string) => {
      localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
      await fetchMe(accessToken);
    },
    [fetchMe]
  );

  const register = useCallback(
    async (username: string, password: string, email: string, emailCode: string) => {
      const body = {
        username,
        password,
        email: email.trim(),
        email_code: emailCode.trim(),
      };
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      await login(username, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        loginWithEmailCode,
        register,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
