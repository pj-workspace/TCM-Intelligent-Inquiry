<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import type { ApiResult } from '@/types/api'
import type { KnowledgeBase } from '@/types/knowledge'
import type { AgentRunResponse } from '@/types/agent'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'
import MarkdownContent from '@/components/MarkdownContent.vue'

const health = ref('加载中…')
const task = ref('请根据图像与知识库摘录，说明该药材可能的名称及使用注意。')
/** 空字符串表示不用知识库 */
const kbSelection = ref<string>('')
const bases = ref<KnowledgeBase[]>([])
const ragTopK = ref(4)
const ragThreshold = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<AgentRunResponse | null>(null)

async function refreshHealth() {
  try {
    const { data } = await apiClient.get<ApiResult<string>>('/v1/agent/health')
    health.value = formatHealthStatus(data.code, data.message ?? '')
  } catch (e) {
    health.value = getErrorMessage(e)
  }
}

async function loadBases() {
  try {
    const { data } = await apiClient.get<ApiResult<KnowledgeBase[]>>('/v1/knowledge/bases')
    if (data.code !== 0) throw new Error(data.message)
    bases.value = data.data ?? []
  } catch {
    /* 知识库不可用时仍可跑纯对话/识图 */
  }
}

async function runJsonOnly() {
  error.value = null
  result.value = null
  loading.value = true
  try {
    const body: Record<string, unknown> = { task: task.value.trim() }
    if (kbSelection.value !== '') {
      body.knowledgeBaseId = Number(kbSelection.value)
      body.ragTopK = ragTopK.value
      body.ragSimilarityThreshold = ragThreshold.value
    }
    const { data } = await apiClient.post<ApiResult<AgentRunResponse>>('/v1/agent/run', body)
    if (data.code !== 0) throw new Error(data.message)
    result.value = data.data ?? null
  } catch (e) {
    error.value = getErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function onImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f || !task.value.trim()) {
    error.value = '请先填写任务描述，再选择图片'
    return
  }
  error.value = null
  result.value = null
  loading.value = true
  try {
    const fd = new FormData()
    fd.append('task', task.value.trim())
    if (kbSelection.value !== '') {
      fd.append('knowledgeBaseId', kbSelection.value)
      fd.append('ragTopK', String(ragTopK.value))
      fd.append('ragSimilarityThreshold', String(ragThreshold.value))
    }
    fd.append('image', f)
    const { data } = await apiClient.post<ApiResult<AgentRunResponse>>('/v1/agent/run', fd)
    if (data.code !== 0) throw new Error(data.message)
    result.value = data.data ?? null
  } catch (e) {
    error.value = getErrorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refreshHealth()
  await loadBases()
})
</script>

<template>
  <div class="ds-page" style="max-width: 45rem">
    <h2 class="ds-h2">中医智能体</h2>
    <p
      class="ds-status agent-health"
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
    <p class="ds-lead">
      文本对话走默认 Ollama Chat 模型；上传图片时使用配置的视觉模型（如 qwen3-vl）。可选勾选知识库，将先做向量检索再把摘录与任务一并交给模型。
    </p>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">任务</h3>
      <textarea v-model="task" rows="4" class="ds-textarea" placeholder="描述要让智能体做什么…" />
      <div class="ds-row ds-row--top agent-row">
        <label v-if="bases.length" class="ds-field agent-kb">
          知识库（可选）
          <select v-model="kbSelection" class="ds-select">
            <option value="">不使用知识库</option>
            <option v-for="b in bases" :key="b.id" :value="String(b.id)">
              {{ b.name }} (id={{ b.id }})
            </option>
          </select>
        </label>
        <template v-if="kbSelection !== ''">
          <label class="ds-field">
            RAG Top-K
            <input
              v-model.number="ragTopK"
              class="ds-input ds-input--narrow"
              type="number"
              inputmode="numeric"
              min="1"
              max="20"
            />
          </label>
          <label class="ds-field">
            相似度阈值
            <input
              v-model.number="ragThreshold"
              class="ds-input ds-input--narrow"
              type="number"
              inputmode="decimal"
              min="0"
              max="1"
              step="0.05"
            />
          </label>
        </template>
      </div>
      <div class="ds-row agent-actions">
        <button type="button" class="ds-btn ds-btn--primary" :disabled="loading" @click="runJsonOnly">
          {{ loading ? '运行中…' : '仅文本运行' }}
        </button>
        <label class="ds-file-label ds-file-label--solid agent-file">
          选择图片并运行（多模态）
          <input type="file" accept="image/*" :disabled="loading" @change="onImageChange" />
        </label>
      </div>
      <p v-if="error" class="ds-msg--error">{{ error }}</p>
      <div v-if="result" class="ds-answer agent-out">
        <p class="agent-result-meta">
          <span class="ds-badge">{{ result.mode }}</span>
          <span v-if="result.knowledgeSources?.length" class="ds-muted agent-src">
            知识库来源：{{ result.knowledgeSources.join('、') }}
          </span>
        </p>
        <MarkdownContent class="agent-body" :source="result.assistant" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.agent-health {
  margin-bottom: 0.5rem;
}
.agent-row {
  align-items: flex-end;
}
.agent-kb .ds-select {
  max-width: 100%;
}
.agent-actions {
  align-items: center;
}
.agent-file {
  min-height: 2.75rem;
}
.agent-out {
  margin-top: 1rem;
}
.agent-result-meta {
  margin: 0 0 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.agent-src {
  margin: 0;
}
.agent-body {
  margin: 0;
}
</style>
