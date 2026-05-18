/**
 * 对话区 URL：/chat、/chat/[conversationId]、/chat/folder/[groupId]
 */

/** 宽松 UUID（与后端 conversations.id 形态一致） */
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParsedChatPath =
  | { kind: "new" }
  | { kind: "conversation"; conversationId: string }
  | { kind: "folder"; groupId: string }
  | { kind: "invalid" };

export function normalizePathname(pathname: string): string {
  const p = pathname.trim();
  if (!p || p === "/") return "/";
  return p.replace(/\/+$/, "") || "/";
}

export function isConversationIdSegment(segment: string): boolean {
  const s = segment.trim();
  return s.length > 0 && !s.includes("/") && UUID_LIKE.test(s);
}

export function parseChatPathname(pathname: string): ParsedChatPath {
  const p = normalizePathname(pathname);
  if (p === "/chat") return { kind: "new" };
  if (p.startsWith("/chat/folder")) {
    const rest = p.slice("/chat/folder".length);
    if (rest === "") return { kind: "invalid" };
    const gid = rest.startsWith("/") ? rest.slice(1) : rest;
    if (!gid || gid.includes("/")) return { kind: "invalid" };
    if (!isConversationIdSegment(gid)) return { kind: "invalid" };
    return { kind: "folder", groupId: gid };
  }
  if (p.startsWith("/chat/")) {
    const seg = p.slice("/chat/".length);
    if (!seg || seg.includes("/")) return { kind: "invalid" };
    if (!isConversationIdSegment(seg)) return { kind: "invalid" };
    return { kind: "conversation", conversationId: seg };
  }
  return { kind: "invalid" };
}

export function chatPathNew(): string {
  return "/chat";
}

export function chatPathConversation(conversationId: string): string {
  const id = conversationId.trim();
  return `/chat/${encodeURIComponent(id)}`;
}

export function chatPathFolder(groupId: string): string {
  const id = groupId.trim();
  return `/chat/folder/${encodeURIComponent(id)}`;
}
