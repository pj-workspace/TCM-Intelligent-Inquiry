/** 常见推理块：思考标签、redacted_thinking 成对标签、以及 `think` 围栏 */
type XmlPattern = {
  full: RegExp
  open: RegExp
  close: RegExp
}

/**
 * 顺序：`<think>…</think>`（原仓库）、`<redacted_thinking>…</redacted_thinking>`（DeepSeek 等）。
 * 使用 RegExp 字符串构造，避免源文件中的反引号被环境改写。
 */
const XML_PATTERNS: XmlPattern[] = [
  {
    full: new RegExp('^\\s*<think>([\\s\\S]*?)<\\/think>\\s*', 'i'),
    open: new RegExp('^\\s*<think>', 'i'),
    close: new RegExp('<\\/think>', 'i'),
  },
  {
    full: new RegExp(
      '^\\s*<redacted_thinking>([\\s\\S]*?)<\\/redacted_thinking>\\s*',
      'i'
    ),
    open: new RegExp('^\\s*<redacted_thinking>', 'i'),
    close: new RegExp('<\\/redacted_thinking>', 'i'),
  },
]

/** \u0060think\u0060 … \u0060/think\u0060 */
const BT_OPEN = '\u0060think\u0060'
const BT_CLOSE = '\u0060/think\u0060'

export type ThinkSplit = {
  think: string | null
  rest: string
  thinkIncomplete: boolean
}

/**
 * 拆出可折叠「思考」与对外正文（后者按 Markdown 渲染）。
 */
export function splitThinkFromAssistant(text: string): ThinkSplit {
  const t = text ?? ''

  for (const p of XML_PATTERNS) {
    const xml = t.match(p.full)
    if (xml) {
      return {
        think: xml[1].trim() || null,
        rest: t.slice(xml[0].length).trimStart(),
        thinkIncomplete: false,
      }
    }
    if (p.open.test(t) && !p.close.test(t)) {
      const inner = t.replace(p.open, '').trimStart()
      return {
        think: inner.trim() || '…',
        rest: '',
        thinkIncomplete: true,
      }
    }
  }

  const trimStart = t.trimStart()
  if (trimStart.startsWith(BT_OPEN)) {
    const afterOpen = trimStart.slice(BT_OPEN.length)
    const closeIdx = afterOpen.indexOf(BT_CLOSE)
    if (closeIdx === -1) {
      return {
        think: afterOpen.trim() || '…',
        rest: '',
        thinkIncomplete: true,
      }
    }
    const thinkBody = afterOpen.slice(0, closeIdx).trim()
    const rest = afterOpen.slice(closeIdx + BT_CLOSE.length).trimStart()
    return {
      think: thinkBody || null,
      rest,
      thinkIncomplete: false,
    }
  }

  return { think: null, rest: t, thinkIncomplete: false }
}
