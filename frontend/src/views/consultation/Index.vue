<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { apiClient } from '@/api/client'
import type { ApiResult } from '@/types/api'
import ChatBubble from '@/components/ChatBubble.vue'
import { useChat } from '@/composables/useChat'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'

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
    health.value = formatHealthStatus(data.code, data.message ?? '')
  } catch (e) {
    health.value = e instanceof Error ? `后端不可用: ${e.message}` : '后端不可用'
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
  <div class="consult-chat ds-page ds-page--chat ds-main__grow">
    <header>
      <h2 class="ds-h2">中医智能问诊</h2>
      <p
        class="ds-status"
        :class="
          isHealthStatusErr(health)
            ? 'ds-status--err'
            : isHealthStatusOk(health)
              ? 'ds-status--ok'
              : ''
        "
      >
        {{ health }}
      </p>
      <p v-if="sessionId != null" class="consult-meta">当前会话 ID：{{ sessionId }}</p>
    </header>

    <details class="ds-details">
      <summary>模型与上下文参数</summary>
      <div class="ds-details__body">
        <div class="ds-row consult-controls">
          <label class="ds-field">
            Temperature
            <input
              v-model.number="temperature"
              class="ds-input ds-input--narrow"
              type="number"
              inputmode="decimal"
              min="0"
              max="2"
              step="0.1"
              :disabled="loading"
            />
          </label>
          <label class="ds-field">
            历史轮数上限
            <input
              v-model.number="maxHistoryTurns"
              class="ds-input ds-input--narrow"
              type="number"
              inputmode="numeric"
              min="1"
              max="50"
              step="1"
              :disabled="loading"
            />
          </label>
        </div>
      </div>
    </details>

    <div class="ds-row consult-actions">
      <button type="button" class="ds-btn ds-btn--secondary" :disabled="loading" @click="onNewChat">
        新建会话
      </button>
      <button v-if="loading" type="button" class="ds-btn ds-btn--warn" @click="stop">停止</button>
    </div>

    <p v-if="error" class="ds-msg--error">{{ error }}</p>
    <p v-if="loading && !streamingContent" class="ds-hint" style="margin-top: 0">助手思考中…</p>

    <div ref="threadEl" class="ds-thread" role="region" aria-label="对话内容">
      <div
        v-if="messages.length === 0 && !loading && !streamingContent"
        class="ds-thread-empty"
      >
        <p class="ds-thread-empty__title">开始一次问诊</p>
        <p class="ds-thread-empty__hint">
          用自然语言描述症状或体质疑问；Enter 发送，Shift+Enter 可换行（若浏览器支持）。
        </p>
      </div>
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

    <form class="ds-composer" @submit.prevent="onSend">
      <textarea
        v-model="input"
        class="ds-textarea"
        rows="3"
        placeholder="描述症状、体征或想咨询的问题…"
        :disabled="loading"
        @keydown.enter.exact.prevent="onSend"
      />
      <button type="submit" class="ds-btn ds-btn--primary" :disabled="loading || !input.trim()">
        发送
      </button>
    </form>
  </div>
</template>

<style scoped>
.consult-chat {
  width: 100%;
  min-height: min(28rem, 52dvh);
}
.consult-meta {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}
.consult-controls {
  margin-top: 0;
}
.consult-actions {
  margin-top: 0.35rem;
  margin-bottom: 0.25rem;
  gap: 0.65rem;
}
</style>
