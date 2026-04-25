export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export const TOKEN_KEY = "tcm_access_token";

/**
 * 管理类接口使用 `require_api_user`：JWT + 可选 `API_KEY`。
 * 后端 `.env` 中 `API_KEY` 非空时，请求须带 `X-API-Key`（与后端值一致）。
 * 前端在 `.env.local` 配置 `NEXT_PUBLIC_API_KEY`（与后端 `API_KEY` 相同），构建时注入。
 */
export function apiHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  const key = (process.env.NEXT_PUBLIC_API_KEY ?? "").trim();
  if (key) h["X-API-Key"] = key;
  return h;
}

export function apiJsonHeaders(token: string | null): Record<string, string> {
  return { ...apiHeaders(token), "Content-Type": "application/json" };
}

export async function parseApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      detail?: unknown;
      message?: unknown;
    };
    const msg = j.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d))
      return d.map((x: { msg?: string }) => x.msg ?? "").filter(Boolean).join("；");
  } catch {
    /* ignore */
  }
  return res.statusText || "请求失败";
}
