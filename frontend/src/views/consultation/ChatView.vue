<script setup lang="ts">
import { inject, onMounted, ref, watch, nextTick } from 'vue'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import type { ApiResult } from '@/types/api'
import type { KnowledgeBase } from '@/types/knowledge'
import ChatBubble from '@/components/ChatBubble.vue'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'
import { CONSULT_CHAT_KEY } from '@/views/consultation/consultChatKey'

const chat = inject(CONSULT_CHAT_KEY)
if (!chat) {
  throw new Error('ConsultChatView must be mounted under ConsultationLayout')
}

const {
  sessionId,
  messages,
  loading,
  error,
  streamingContent,
  ragMeta,
  send,
  stop,
} = chat

const health = ref<string>('加载中…')
const threadEl = ref<HTMLElement | null>(null)
const input = ref('')
const temperature = ref(0.7)
const maxHistoryTurns = ref(10)
const knowledgeBases = ref<KnowledgeBase[]>([])
const kbSelection = ref<string>('')
const ragTopK = ref(4)

async function loadKnowledgeBases() {
  try {
    const { data } = await apiClient.get<ApiResult<KnowledgeBase[]>>(
      '/v1/knowledge/bases'
    )
    if (data.code !== 0) return
    knowledgeBases.value = data.data ?? []
  } catch {
    /* 知识库不可用时仍可纯问诊 */
  }
}

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
    health.value = `后端不可用: ${getErrorMessage(e)}`
  }
  void loadKnowledgeBases()
})

async function onSend() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  const kb =
    kbSelection.value === '' ? null : Number.parseInt(kbSelection.value, 10)
  await send(text, {
    temperature: temperature.value,
    maxHistoryTurns: maxHistoryTurns.value,
    scrollRoot: threadEl.value,
    knowledgeBaseId: Number.isFinite(kb) ? kb : null,
    ragTopK: ragTopK.value,
  })
}
</script>

<template>
  <div class="consult-chat ds-main__grow">
    <header class="consult-header">
      <div class="consult-header__top">
        <div class="consult-header__main">
          <h2 class="ds-h2 consult-header__title">
            中医智能问诊
          </h2>
          <p
            class="ds-status consult-header__status"
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
          <details class="consult-adv">
            <summary class="consult-adv__summary">
              模型、知识库与上下文
            </summary>
            <div class="consult-adv__body">
              <div class="ds-row consult-controls consult-controls--wrap">
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
                  >
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
                  >
                </label>
                <label
                  v-if="knowledgeBases.length > 0"
                  class="ds-field"
                >
                  关联知识库（可选）
                  <select
                    v-model="kbSelection"
                    class="ds-select consult-adv__select"
                    :disabled="loading"
                  >
                    <option value="">
                      不使用知识库
                    </option>
                    <option
                      v-for="b in knowledgeBases"
                      :key="b.id"
                      :value="String(b.id)"
                    >
                      {{ b.name }}
                    </option>
                  </select>
                </label>
                <label
                  v-if="knowledgeBases.length > 0 && kbSelection !== ''"
                  class="ds-field"
                >
                  RAG topK
                  <input
                    v-model.number="ragTopK"
                    class="ds-input ds-input--narrow"
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    :disabled="loading"
                  >
                </label>
              </div>
            </div>
          </details>
        </div>
        <div class="consult-header__side">
          <button
            v-if="loading"
            type="button"
            class="ds-btn ds-btn--warn consult-header__stop"
            @click="stop"
          >
            停止
          </button>
          <p
            v-if="sessionId != null"
            class="consult-meta"
            title="调试/技术支持用会话标识"
          >
            会话 #{{ sessionId }}
          </p>
        </div>
      </div>
    </header>

    <p
      v-if="error"
      class="ds-msg--error"
    >
      {{ error }}
    </p>
    <p
      v-if="ragMeta"
      class="ds-hint consult-rag-meta"
    >
      本回合已注入知识库 #{{ ragMeta.knowledgeBaseId }}，检索到
      {{ ragMeta.retrievedChunks }} 条相关片段<span
        v-if="ragMeta.sources.length"
      >；来源：{{ ragMeta.sources.join('、') }}</span>。
    </p>
    <p
      v-if="loading && !streamingContent"
      class="ds-hint consult-thinking"
    >
      助手思考中…
    </p>

    <div
      ref="threadEl"
      class="ds-thread consult-thread"
      role="region"
      aria-label="对话内容"
    >
      <div
        v-if="messages.length === 0 && !loading && !streamingContent"
        class="ds-thread-empty"
      >
        <p class="ds-thread-empty__title">
          开始一次问诊
        </p>
        <p class="ds-thread-empty__hint">
          用自然语言描述症状或体质疑问；Enter
          发送。左侧可切换历史会话。
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

    <form
      class="consult-composer"
      @submit.prevent="onSend"
    >
      <div class="consult-composer__shell">
        <textarea
          v-model="input"
          class="consult-composer__input"
          rows="3"
          placeholder="描述症状、体征或想咨询的问题…"
          :disabled="loading"
          @keydown.enter.exact.prevent="onSend"
        />
        <button
          type="submit"
          class="ds-btn ds-btn--primary ds-btn--icon consult-composer__send"
          :disabled="loading || !input.trim()"
          aria-label="发送"
          title="发送"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.consult-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.consult-header {
  flex-shrink: 0;
  margin-bottom: 0.2rem;
}

.consult-header__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.consult-header__main {
  min-width: 0;
  flex: 1;
  text-align: left;
}

.consult-header__title {
  margin: 0 0 0.25rem;
}

.consult-header__status {
  margin: 0 0 0.3rem;
}

.consult-header__side {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.consult-header__stop {
  font-size: 0.8125rem;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.consult-meta {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

/* 弱化的高级选项：默认仅占一行 summary，展开后再占高度 */
.consult-adv {
  margin: 0;
  margin-top: 0.1rem;
  padding: 0;
  border: none;
  background: transparent;
}

.consult-adv__summary {
  list-style: none;
  cursor: pointer;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0.1rem 0;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-muted);
  border: none;
  background: transparent;
}

.consult-adv__summary::-webkit-details-marker {
  display: none;
}

.consult-adv__summary::after {
  content: ' ▾';
  font-size: 0.65rem;
  opacity: 0.8;
}

.consult-adv[open] > .consult-adv__summary {
  color: var(--color-text-secondary);
}

.consult-adv__summary:hover {
  color: var(--color-primary-hover);
}

.consult-adv__body {
  margin-top: 0.35rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--color-border);
}

.consult-adv__select {
  min-width: 10rem;
  max-width: min(100%, 20rem);
}

.consult-controls {
  margin-top: 0;
}

.consult-controls--wrap {
  flex-wrap: wrap;
}

.consult-rag-meta {
  margin-top: 0.25rem;
  margin-bottom: 0;
  font-size: 0.8125rem;
}

.consult-thinking {
  margin-top: 0.15rem;
  margin-bottom: 0;
}

.consult-thread {
  flex: 1;
  min-height: 0;
}

.consult-composer {
  margin-top: 0.75rem;
  flex-shrink: 0;
}

.consult-composer__shell {
  position: relative;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: var(--transition-fast);
  /* 避免个别浏览器在角落绘出缩放相关装饰 */
  overflow: hidden;
}

.consult-composer__shell:focus-within {
  border-color: var(--color-secondary);
  box-shadow: var(--focus-ring);
}

.consult-composer__input {
  display: block;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  padding: 12px 60px 12px 16px;
  min-height: 5.25rem;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-surface);
  border: none;
  border-radius: var(--radius-md);
  outline: none;
  resize: none !important;
  overflow-y: auto;
}

/* WebKit：彻底隐藏右下角缩放手柄纹理 */
.consult-composer__input::-webkit-resizer {
  display: none;
  appearance: none;
}

.consult-composer__input::placeholder {
  color: var(--color-muted);
}

.consult-composer__input:focus {
  outline: none;
}

.consult-composer__send {
  position: absolute;
  bottom: 0.65rem;
  right: 0.65rem;
  width: var(--ds-control-height);
  height: var(--ds-control-height);
  border-radius: var(--radius-control);
}

@media (max-width: 52rem) {
  .consult-header__top {
    flex-direction: column;
    align-items: stretch;
  }

  .consult-header__side {
    justify-content: space-between;
  }
}
</style>
