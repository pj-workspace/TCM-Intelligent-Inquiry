import type { Components } from "react-markdown";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 模型常把有序列表写成「单独一行的 1. / 2.」再换行写正文，CommonMark 无法将其识别为同一条列表项。
 * 合并为「1. 正文」以便正确渲染为 ol/li。
 * 支持：编号与正文之间有多余空行、或中间仅有空白/空格行；支持半角 `.` 与全角 `．`。
 */
function mergeOrphanOrderedListMarkers(md: string): string {
  let prev = md;
  for (let i = 0; i < 8; i++) {
    const next = prev.replace(
      /(^|\n)(\d{1,3})(?:\.|．)[ \t]*(?:\r?\n[ \t]*)+(?=\S)/g,
      "$1$2. "
    );
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

/** GFM 表格只识别 ASCII `|`；部分模型会输出全角竖线 U+FF5C，导致无法解析为表格。 */
function normalizeGfmPipes(md: string): string {
  return md.replace(/\uFF5C/g, "|");
}

export function preprocessAssistantMarkdown(md: string): string {
  return mergeOrphanOrderedListMarkers(normalizeGfmPipes(md));
}

/** 用于复制 / 朗读 / PDF 的纯文本（弱化 Markdown 标记） */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function exportAssistantAsPdf(title: string, markdown: string) {
  const plain = markdownToPlainText(markdown);
  const w = window.open("", "_blank");
  if (!w) return;
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(
    title
  )}</title><style>
    body{font-family:system-ui,sans-serif;padding:28px;max-width:720px;margin:0 auto;color:#111;line-height:1.6}
    h1{font-size:1.25rem;font-weight:600;margin:0 0 16px}
    pre{white-space:pre-wrap;word-break:break-word;font-size:14px;margin:0}
    @media print{body{padding:16px}}
  </style></head><body>
  <h1>${escapeHtml(title)}</h1>
  <pre>${escapeHtml(plain)}</pre>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;
  w.document.write(doc);
  w.document.close();
}

/** 助手正文已用 remark-gfm 解析为 table 元素；需显式边框与横向滚动，否则会像「挤成一行的纯文本」。 */
export const assistantMarkdownComponents: Components = {
  table: ({ node: _n, children, ...props }) => (
    <div className="no-scrollbar my-4 w-full max-w-full overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg)]">
      <table
        className="w-full min-w-[min(100%,520px)] border-collapse text-[0.95rem] leading-snug"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ node: _n, children, ...props }) => (
    <thead {...props}>{children}</thead>
  ),
  th: ({ node: _n, children, ...props }) => (
    <th
      className="border border-[var(--border-color)] bg-[var(--muted)] px-3 py-2 text-left font-semibold text-[var(--fg)]"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node: _n, children, ...props }) => (
    <td
      className="border border-[var(--border-color)] px-3 py-2 align-top text-[var(--fg)]"
      {...props}
    >
      {children}
    </td>
  ),
};
