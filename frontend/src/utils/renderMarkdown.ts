import MarkdownIt from 'markdown-it'
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
import multimdTable from 'markdown-it-multimd-table'
import DOMPurify from 'dompurify'
import type { Config as DomPurifyConfig } from 'dompurify'

/**
 * 从左到右组合变换。Chat / Agent / RAG 渲染前共用同一规范化管线时可显式组合。
 */
export function pipe<T>(initial: T, ...fns: ReadonlyArray<(x: T) => T>): T {
  return fns.reduce((acc, f) => f(acc), initial)
}

/**
 * 企业级 Markdown 源码规范化：NFC、流式围栏、粘连拆解（不含 HTML 渲染）。
 * 与 markdownToSafeHtml 内部使用同一逻辑。
 */
export function enterpriseMarkdownNormalize(
  source: string,
  options: MarkdownRenderOptions = {}
): string {
  const streaming = options.streaming !== false
  return pipe(
    source ?? '',
    (s) => s.normalize('NFC'),
    (s) => (streaming ? stabilizeStreamingMarkdown(s) : s),
    normalizeLooseMarkdown
  )
}

/**
 * Markdown → HTML：规范化工序 + markdown-it + DOMPurify。
 * 等价于 `enterpriseMarkdownNormalize` 后 `markdown.render` + sanitize。
 */
export function enterpriseMarkdownToSafeHtml(
  source: string,
  options: MarkdownRenderOptions = {}
): string {
  const src = source ?? ''
  if (!src.trim()) return ''
  return markdownToSafeHtmlInternal(enterpriseMarkdownNormalize(src, options))
}

/**
 * 企业级 Markdown → HTML：GFM 风格、换行容错、流式半截围栏补全，再经 DOMPurify 清洗。
 * html: false 禁用源码中的原始 HTML，降低 XSS 面；清洗阶段再收紧一遍。
 */
const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: false,
})
  .use(multimdTable)
  .use(MarkdownItGitHubAlerts, {
    titles: {
      note: '说明',
      tip: '提示',
      important: '重要',
      warning: '警告',
      caution: '风险提示',
    },
  })

let purifyHooksInstalled = false

function installPurifyHooks(): void {
  if (purifyHooksInstalled || typeof DOMPurify.addHook !== 'function') return
  purifyHooksInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A' || !(node instanceof HTMLAnchorElement)) return
    const href = node.getAttribute('href')
    if (!href || href.startsWith('javascript:') || href.startsWith('data:')) {
      node.removeAttribute('href')
      return
    }
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

installPurifyHooks()

/** 外链、代码块、GitHub Alerts（含 svg 图标）等；禁止 script / iframe 等 */
const PURIFY: DomPurifyConfig = {
  USE_PROFILES: { html: true },
  ALLOWED_TAGS: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'del',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'path',
    'pre',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'svg',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'class',
    'target',
    'rel',
    'src',
    'alt',
    'colspan',
    'rowspan',
    'align',
    'dir',
    'viewBox',
    'd',
    'fill',
    'xmlns',
    'version',
    'width',
    'height',
    'aria-hidden',
    'focusable',
  ],
  ALLOW_DATA_ATTR: false,
}

/**
 * 流式输出时若围栏代码块未闭合（奇数个 ```），补一条结束围栏，避免后续整块被当成代码或布局乱跳。
 */
export function stabilizeStreamingMarkdown(raw: string): string {
  const s = raw ?? ''
  if (!s.includes('```')) return s
  const parts = s.split('```')
  if (parts.length % 2 === 0) return s
  return `${s}\n\`\`\`\n`
}

/**
 * 将「粘在一行里的」标题/分隔线/列表拆开（模型常输出 `---###标题1.小标题-要点` 等）。
 * 仅在围栏外执行；多轮替换直到稳定。
 */
function expandAssistantMarkdownGlitches(segment: string): string {
  let s = segment
  let prev = ''
  for (let i = 0; i < 12 && s !== prev; i++) {
    prev = s
    s = s
      // **加粗结束**紧接「-××」且后为汉字（模型常输出 **2. 保暖**-穿着…）
      .replace(/(?<=\*\*)(-)(?=[\u4e00-\u9fff])/g, '\n\n$1')
      // 汉字与「1.」之间仅有空格（建议 1.××）
      .replace(
        /([\u4e00-\u9fff）)\]》])(\s{1,4})([1-9]\d{0,2}\.)(?=[\s*#\u4e00-\u9fff])/g,
        '$1\n\n$3'
      )
      // 「：---###标题…」：保留整段标题到换行（勿只取标题首字）
      .replace(
        /([:：。！？;；])(\s*)(---+)\s*(#{1,6})\s*([^\s#\n][^\n]*)/g,
        '$1$2\n\n$3\n\n$4 $5'
      )
      // 标点后仅横线、后接非 # 时拆行（避免与上条重复匹配「：---###」）
      .replace(
        /([:：。！？;；])(\s*)(---+)(?!\s*#{1,6})/g,
        '$1$2\n\n$3\n\n'
      )
      .replace(/---+(\s*)(#{1,6})\s*([^\s#\n][^\n]*)/g, '---\n\n$2 $3')
      .replace(/---+(\s*)(#{1,6})\s*$/g, '---\n\n$2 ')
      // 行内紧跟在正文后的 ATX（标题首字为 CJK，避免误伤英文 #3）
      .replace(/([^\n#])(#{1,6})([\u4e00-\u9fff])/g, '$1\n\n$2 $3')
      // 句读、冒号后接有序列表
      .replace(/([:：。！？;；])(\s*)([1-9]\d{0,2}\.)(?=[^\d\n])/g, '$1$2\n\n$3')
      // 汉字或闭括号后直接接「1.」类（如「建议1.」）
      .replace(
        /([\u4e00-\u9fff）)\]》])([1-9]\d{0,2}\.)(?=[^\d\n\s])/g,
        '$1\n\n$2'
      )
      // 句号、分号后接「- / · / •」再跟汉字（列表项；勿匹配 \n 以免叠行）
      .replace(/([。；！？])(\s*)([-*·•])(?=[\u4e00-\u9fff])/g, '$1$2\n\n$3')
      // 汉字后直接「-××」且下一字为汉字（如「循环-每天」）
      .replace(
        /([\u4e00-\u9fff）)\]》])(\s*)([-*+])(?=[\u4e00-\u9fff])/g,
        '$1$2\n\n$3'
      )
  }
  return s.replace(/\n{3,}/g, '\n\n')
}

/**
 * ATX 标题整行被模型写成「### 小节标题1.第一条…」，CommonMark 会把「1.」也吞进标题字串；
 * 仅在标题语以 CJK/常见闭括号结束时，把「1.」拆成下文有序列表。
 */
function splitAtxHeadingGluedOrderedList(line: string): string {
  return line.replace(
    /^(#{1,6})\s*(.+?)([1-9]\d{0,2}\.)(?=[\s]*[\u4e00-\u9fff*])([^\n]*)$/u,
    (full, hashes: string, title: string, listStart: string, rest: string) => {
      const t = title.trimEnd()
      if (!/[\u4e00-\u9fff）)\]》]]$/.test(t)) return full
      return `${hashes} ${t}\n\n${listStart}${rest}`
    }
  )
}

/**
 * 「一、生活调养1.保暖」类：中文章节序号与阿拉伯数字小条款粘在同一行。
 */
function splitChineseEnumerationGluedOrderedList(line: string): string {
  return line.replace(
    /^([一二三四五六七八九十百两〇]{1,3}、)\s*(.+?)([1-9]\d{0,2}\.)(?=[\s]*[\u4e00-\u9fff*])([^\n]*)$/u,
    (full, sec: string, title: string, listStart: string, rest: string) => {
      const t = title.trimEnd()
      if (!/[\u4e00-\u9fff）)\]》]]$/.test(t)) return full
      return `${sec}${t}\n\n${listStart}${rest}`
    }
  )
}

/** 「**小标题**1.第一条」同理拆行（无 # 时模型常用加粗当标题） */
function splitStrongHeadingGluedOrderedList(line: string): string {
  return line.replace(
    /^\*\*(.+?)\*\*([1-9]\d{0,2}\.)(?=[\s]*[\u4e00-\u9fff*])([^\n]*)$/u,
    (full, title: string, listStart: string, rest: string) => {
      const t = title.trimEnd()
      if (!/[\u4e00-\u9fff）)\]》]]$/.test(t)) return full
      return `**${title}**\n\n${listStart}${rest}`
    }
  )
}

/**
 * 模型常见输出不符合 CommonMark：`###标题`、`1.项`、`-项` 等；在围栏代码块外补空格以便解析为标题/列表。
 */
export function normalizeLooseMarkdown(raw: string): string {
  const normalizedInput = (raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
  const lines = normalizedInput.split('\n')
  let inFence = false
  const out: string[] = []
  for (const line of lines) {
    const trim = line.trimStart()
    if (trim.startsWith('```')) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    const expanded = expandAssistantMarkdownGlitches(line)
    for (const piece of expanded.split('\n')) {
      let L = piece
      L = L.replace(/^(#{1,6})([^\s#])/, '$1 $2')
      L = splitAtxHeadingGluedOrderedList(L)
      L = splitChineseEnumerationGluedOrderedList(L)
      L = splitStrongHeadingGluedOrderedList(L)
      for (const row of L.split('\n')) {
        let P = row
        P = P.replace(/^(\d{1,3})\.([^\s.\d])/, '$1. $2')
        P = P.replace(/^([-*+·•])([^\s*+-·•])/, '$1 $2')
        out.push(P)
      }
    }
  }
  return out.join('\n')
}

export type MarkdownRenderOptions = {
  /** 是否对流式半截 Markdown 做围栏补全，默认 true */
  streaming?: boolean
}

function markdownToSafeHtmlInternal(markdownSource: string): string {
  try {
    const html = markdown.render(markdownSource)
    return DOMPurify.sanitize(html, PURIFY)
  } catch {
    const escaped = markdownSource
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return DOMPurify.sanitize(`<p>${escaped.replace(/\n/g, '<br/>')}</p>`, PURIFY)
  }
}

/**
 * 将 Markdown 转为可安全插入页面的 HTML（助手 / RAG 内容专用，勿用于未约束的用户 HTML）。
 */
export function markdownToSafeHtml(
  source: string,
  options: MarkdownRenderOptions = {}
): string {
  const src = source ?? ''
  if (!src.trim()) return ''
  const input = enterpriseMarkdownNormalize(src, options)
  return markdownToSafeHtmlInternal(input)
}
