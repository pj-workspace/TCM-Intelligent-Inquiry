import DOMPurify from 'dompurify'
import type { Config as DomPurifyConfig } from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

const PURIFY: DomPurifyConfig = {
  USE_PROFILES: { html: true },
}

/**
 * 将 Markdown 转为可安全插入页面的 HTML（助手内容专用，勿用于用户原始 HTML）。
 */
export function markdownToSafeHtml(source: string): string {
  const raw = source ?? ''
  if (!raw.trim()) return ''
  const html = marked.parse(raw, { async: false }) as string
  return DOMPurify.sanitize(html, PURIFY)
}
