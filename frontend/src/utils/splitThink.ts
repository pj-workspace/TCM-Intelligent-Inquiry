/** 常见推理 / 思考块（DeepSeek / Qwen 类、部分开源对齐） */
const RE_XML_THINK = /^\s*<think>([\s\S]*?)<\/think>\s*/i
const RE_XML_OPEN = /^\s*<think>/i

/** `think` … ` */
const BT_OPEN = '\u0060think\u0060'
/** ` */
const BT_CLOSE = '\u0060/think\u0060'

export type ThinkSplit = {
  think: string | null
  rest: string
  thinkIncomplete: boolean
}

/**
 * 拆出可折叠「思考」与对外正文（后者按 Markdown 渲染）。
 * 支持：<think>...</think>、`...`</think>``
 */
export function splitThinkFromAssistant(text: string): ThinkSplit {
  const t = text ?? ''

  const xml = t.match(RE_XML_THINK)
  if (xml) {
    return {
      think: xml[1].trim() || null,
      rest: t.slice(xml[0].length).trimStart(),
      thinkIncomplete: false,
    }
  }

  if (RE_XML_OPEN.test(t) && !/<\/think>/i.test(t)) {
    const inner = t.replace(/^\s*<think>\s*/i, '')
    return {
      think: inner.trim() || '…',
      rest: '',
      thinkIncomplete: true,
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
    const think = afterOpen.slice(0, closeIdx).trim()
    const rest = afterOpen.slice(closeIdx + BT_CLOSE.length).trimStart()
    return {
      think: think || null,
      rest,
      thinkIncomplete: false,
    }
  }

  return { think: null, rest: t, thinkIncomplete: false }
}
