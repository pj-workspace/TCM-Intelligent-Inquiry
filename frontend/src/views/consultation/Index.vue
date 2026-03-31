<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { apiClient } from '@/api/client'
import type { ApiResult } from '@/types/api'
import ChatBubble from '@/components/ChatBubble.vue'
import { useChat } from '@/composables/useChat'

const health = ref<string>('加载中…')
const threadEl = ref<HTMLElement | null>(null)
const input = ref('')
const temperature = ref(0.7)
const maxHistoryTurns = ref(10)

const {
  sessionId,
  messages,
  loading,
  error,
  streamingContent,
  newSession,
  send,
  stop,
} = useChat()

function scrollToBottom() {
  nextTick(() => {
    const el = threadEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => [messages.value, streamingContent.value],
  () => scrollToBottom(),
  { deep: true }
)

onMounted(async () => {
  try {
    const { data } = await apiClient.get<ApiResult<string>>('/v1/consultation/health')
    health.value = `服务正常 code=${data.code} ${data.message}`
  } catch (e) {
    health.value =
      e instanceof Error ? `后端不可用: ${e.message}` : '后端不可用'
  }
  try {
    await newSession()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建会话失败'
  }
})

async function onSend() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  await send(text, {
    temperature: temperature.value,
    maxHistoryTurns: maxHistoryTurns.value,
    scrollRoot: threadEl.value,
  })
}

function onNewChat() {
  if (loading.value) stop()
  newSession().catch((e) => {
    error.value = e instanceof Error ? e.message : String(e)
  })
}
</script>

<template>
  <div class="page">
    <header class="header">
      <h2>中医智能问诊</h2>
      <p class="health">{{ health }}</p>
      <p v-if="sessionId != null" class="meta">当前会话 ID：{{ sessionId }}</p>
    </header>

    <div class="controls">
      <label class="field">
        <span>Temperature</span>
        <input
          v-model.number="temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
          :disabled="loading"
        />
      </label>
      <label class="field">
        <span>历史轮数上限</span>
        <input
          v-model.number="maxHistoryTurns"
          type="number"
          min="1"
          max="50"
          step="1"
          :disabled="loading"
        />
      </label>
      <button type="button" class="btn secondary" :disabled="loading" @click="onNewChat">
        新建会话
      </button>
      <button v-if="loading" type="button" class="btn warn" @click="stop">停止</button>
    </div>

    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="loading && !streamingContent" class="hint">助手思考中…</p>

    <div ref="threadEl" class="thread">
      <ChatBubble
        v-for="(m, i) in messages"
        :key="i"
        :role="m.role"
        :content="m.content"
      />
      <ChatBubble
        v-if="loading && streamingContent"
        role="assistant"
        :content="streamingContent"
      />
    </div>

    <form class="composer" @submit.prevent="onSend">
      <textarea
        v-model="input"
        class="input"
        rows="3"
        placeholder="描述症状、体征或想咨询的问题…"
        :disabled="loading"
        @keydown.enter.exact.prevent="onSend"
      />
      <button type="submit" class="btn primary" :disabled="loading || !input.trim()">
        发送
      </button>
    </form>
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 3rem);
  min-height: 420px;
}
.header h2 {
  margin: 0 0 0.35rem;
}
.health {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0;
}
.meta {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0.25rem 0 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin: 1rem 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.8rem;
  color: #4b5563;
}
.field input {
  width: 6rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}
.btn {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn.primary {
  background: #059669;
  border-color: #047857;
  color: #fff;
}
.btn.secondary {
  margin-left: auto;
}
.btn.warn {
  background: #fef3c7;
  border-color: #f59e0b;
}
.alert {
  color: #b91c1c;
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}
.hint {
  color: #6b7280;
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}
.thread {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem;
  background: #f9fafb;
}
.composer {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  align-items: flex-end;
}
.composer .input {
  flex: 1;
  resize: vertical;
  min-height: 4rem;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  font-family: inherit;
  font-size: 0.95rem;
}
</style>
