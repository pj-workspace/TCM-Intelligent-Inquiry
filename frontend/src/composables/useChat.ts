import { ref, nextTick } from 'vue'
import { openSseStream } from '@/api/sse'
import { apiClient } from '@/api/client'
import type { ApiResult } from '@/types/api'
import type { ChatMessageView } from '@/types/consultation'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type ChatSessionInfo = {
  id: number
  title: string
  createdAt: string
  updatedAt: string
}

/**
 * 中医问诊：会话创建、历史加载、SSE 流式发送、打字机状态与错误处理。
 */
export function useChat() {
  const sessionId = ref<number | null>(null)
  const messages = ref<ChatTurn[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** 当前一轮助手流式累积（完成后会并入 messages） */
  const streamingContent = ref('')
  let abort: AbortController | null = null

  async function ensureSession() {
    if (sessionId.value != null) return
    const { data } = await apiClient.post<
      ApiResult<ChatSessionInfo>
    >('/v1/consultation/sessions', {})
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || '创建会话失败')
    }
    sessionId.value = data.data.id
  }

  async function loadHistory() {
    if (sessionId.value == null) return
    const { data } = await apiClient.get<ApiResult<ChatMessageView[]>>(
      `/v1/consultation/sessions/${sessionId.value}/messages`
    )
    if (data.code !== 0) {
      throw new Error(data.message || '加载历史失败')
    }
    const list = data.data ?? []
    const next: ChatTurn[] = []
    for (const m of list) {
      next.push({ role: 'user', content: m.userMessage })
      next.push({ role: 'assistant', content: m.assistantMessage })
    }
    messages.value = next
  }

  async function newSession() {
    sessionId.value = null
    messages.value = []
    streamingContent.value = ''
    error.value = null
    await ensureSession()
  }

  function scrollToBottom(el: HTMLElement | null) {
    if (!el) return
    nextTick(() => {
      el.scrollTop = el.scrollHeight
    })
  }

  async function send(
    userText: string,
    opts?: { temperature?: number; maxHistoryTurns?: number; scrollRoot?: HTMLElement | null }
  ) {
    const text = userText.trim()
    if (!text || loading.value) return

    await ensureSession()
    if (sessionId.value == null) throw new Error('无会话')

    error.value = null
    messages.value = [...messages.value, { role: 'user', content: text }]
    streamingContent.value = ''
    loading.value = true
    abort = new AbortController()

    let assistant = ''
    try {
      await openSseStream(
        '/api/v1/consultation/chat',
        (chunk) => {
          if (chunk === '[DONE]') return
          assistant += chunk
          streamingContent.value = assistant
          scrollToBottom(opts?.scrollRoot ?? null)
        },
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.value,
            message: text,
            temperature: opts?.temperature,
            maxHistoryTurns: opts?.maxHistoryTurns,
          }),
          signal: abort.signal,
        }
      )
      messages.value = [
        ...messages.value,
        { role: 'assistant', content: assistant },
      ]
      streamingContent.value = ''
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') {
        error.value = '已停止生成'
        if (assistant) {
          messages.value = [
            ...messages.value,
            { role: 'assistant', content: assistant + '\n…（已中断）' },
          ]
        } else {
          messages.value = messages.value.slice(0, -1)
        }
      } else {
        error.value = e instanceof Error ? e.message : String(e)
        messages.value = messages.value.slice(0, -1)
      }
      streamingContent.value = ''
    } finally {
      loading.value = false
      abort = null
      scrollToBottom(opts?.scrollRoot ?? null)
    }
  }

  function stop() {
    abort?.abort()
  }

  return {
    sessionId,
    messages,
    loading,
    error,
    streamingContent,
    ensureSession,
    loadHistory,
    newSession,
    send,
    stop,
  }
}
