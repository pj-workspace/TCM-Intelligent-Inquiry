export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export const TOKEN_KEY = "tcm_access_token";

export async function parseApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d))
      return d.map((x: { msg?: string }) => x.msg ?? "").filter(Boolean).join("；");
  } catch {
    /* ignore */
  }
  return res.statusText || "请求失败";
}
