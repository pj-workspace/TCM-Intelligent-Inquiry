import { formatStreamHttpError } from './errors'

export interface SseStreamOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
  /** 收到命名事件时回调（如 event: error） */
  onNamedEvent?: (eventName: string, data: string) => void
}

/**
 * 使用 fetch 建立 SSE（text/event-stream），按「空行分帧」解析：合并同一帧内多行 {@code data:}
 * （对齐 SSE 规范与 claw-code 侧对多行 data 的处理），再分发给正文或 {@code onNamedEvent}。
 */
export async function openSseStream(
  url: string,
  onChunk: (data: string) => void,
  options: SseStreamOptions = {}
): Promise<void> {
  const { method = 'GET', headers = {}, body, signal, onNamedEvent } = options
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'text/event-stream',
      ...headers,
    },
    body: method === 'POST' ? body : undefined,
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatStreamHttpError(res.status, res.statusText, text))
  }
  if (!res.body) {
    throw new Error('流式响应无内容，请稍后重试')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let byteBuffer = ''
  let currentEvent = 'message'
  const dataLines: string[] = []

  const dispatchFrame = (): boolean => {
    if (dataLines.length === 0) {
      currentEvent = 'message'
      return false
    }
    const joined = dataLines.join('\n')
    dataLines.length = 0
    const ev = currentEvent
    currentEvent = 'message'

    if (joined === '[DONE]') {
      return true
    }
    if (ev === 'error') {
      onNamedEvent?.('error', joined)
      throw new Error(joined)
    }
    if (ev !== 'message') {
      onNamedEvent?.(ev, joined)
      return false
    }
    onChunk(joined)
    return false
  }

  const consumeFullLines = (): boolean => {
    const lines = byteBuffer.split('\n')
    byteBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmedEnd = line.trimEnd()
      const raw = trimmedEnd.replace(/\r$/, '')
      if (raw === '') {
        if (dispatchFrame()) return true
        continue
      }
      if (raw.startsWith('event:')) {
        currentEvent = raw.slice(6).trim() || 'message'
        continue
      }
      if (raw.startsWith('data:')) {
        dataLines.push(raw.slice(5).trimStart())
        continue
      }
    }
    return false
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value) {
        byteBuffer += decoder.decode(value, { stream: true })
      }
      if (consumeFullLines()) {
        return
      }
      if (done) {
        byteBuffer += decoder.decode()
        if (consumeFullLines()) {
          return
        }
        if (byteBuffer.trim() !== '') {
          const raw = byteBuffer.replace(/\r$/, '')
          byteBuffer = ''
          if (raw.startsWith('data:')) {
            dataLines.push(raw.slice(5).trimStart())
          }
        }
        if (dataLines.length > 0 && dispatchFrame()) {
          return
        }
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
