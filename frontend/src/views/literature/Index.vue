<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import type { ApiResult } from '@/types/api'
import { openSseStream } from '@/api/sse'
import type { LiteratureFileView } from '@/types/literature'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'
import MarkdownContent from '@/components/MarkdownContent.vue'

const health = ref('加载中…')
const collectionId = ref<string | null>(null)
const files = ref<LiteratureFileView[]>([])
const loadingFiles = ref(false)
const uploading = ref(false)
const msg = ref('')
const chunkSize = ref(512)
const queryText = ref('请概括文献中与食疗或体质相关的内容要点。')
const topK = ref(4)
const threshold = ref(0)
const ragAnswer = ref('')
const ragSources = ref<string[]>([])
const ragLoading = ref(false)
const ragError = ref<string | null>(null)
let ragAbort: AbortController | null = null

function stopRag() {
  ragAbort?.abort()
}

async function refreshHealth() {
  try {
    const { data } = await apiClient.get<ApiResult<string>>('/v1/literature/health')
    health.value = formatHealthStatus(data.code, data.message ?? '')
  } catch (e) {
    health.value = getErrorMessage(e)
  }
}

async function loadFiles() {
  if (!collectionId.value) {
    files.value = []
    return
  }
  loadingFiles.value = true
  try {
    const { data } = await apiClient.get<ApiResult<LiteratureFileView[]>>(
      `/v1/literature/collections/${encodeURIComponent(collectionId.value)}/files`
    )
    if (data.code !== 0) throw new Error(data.message)
    files.value = data.data ?? []
  } finally {
    loadingFiles.value = false
  }
}

watch(collectionId, () => {
  void loadFiles()
})

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  uploading.value = true
  msg.value = ''
  try {
    const fd = new FormData()
    fd.append('file', f)
    if (collectionId.value) {
      fd.append('collectionId', collectionId.value)
    }
    if (chunkSize.value > 32) {
      fd.append('chunkSize', String(chunkSize.value))
    }
    const { data } = await apiClient.post<ApiResult<LiteratureFileView>>('/v1/literature/uploads', fd)
    if (data.code !== 0) throw new Error(data.message)
    const row = data.data
    if (row) {
      collectionId.value = row.tempCollectionId
      msg.value = `已解析入库：${row.originalFilename}`
    }
    await loadFiles()
  } catch (e) {
    msg.value = getErrorMessage(e)
  } finally {
    uploading.value = false
  }
}

async function removeFile(fileUuid: string) {
  if (!collectionId.value) return
  await apiClient.delete(
    `/v1/literature/collections/${encodeURIComponent(collectionId.value)}/documents/${encodeURIComponent(fileUuid)}`
  )
  await loadFiles()
}

async function purgeCollection() {
  if (!collectionId.value) return
  if (!confirm('确定删除当前临时文献库及其向量？')) return
  await apiClient.delete(`/v1/literature/collections/${encodeURIComponent(collectionId.value)}`)
  collectionId.value = null
  files.value = []
  ragAnswer.value = ''
  ragSources.value = []
  msg.value = '已清空临时库'
}

async function newCollection() {
  collectionId.value = null
  files.value = []
  ragAnswer.value = ''
  ragSources.value = []
  msg.value = '请上传首个文件，将自动新建临时文献库'
}

async function runQuery() {
  if (!collectionId.value || !queryText.value.trim()) return
  ragLoading.value = true
  ragError.value = null
  ragAnswer.value = ''
  ragSources.value = []
  ragAbort = new AbortController()
  const cid = encodeURIComponent(collectionId.value)
  let acc = ''
  try {
    await openSseStream(
      `/api/v1/literature/collections/${cid}/query/stream`,
      (chunk) => {
        if (chunk === '[DONE]') return
        acc += chunk
        ragAnswer.value = acc
      },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText.value.trim(),
          topK: topK.value,
          similarityThreshold: threshold.value,
        }),
        signal: ragAbort.signal,
        onNamedEvent: (name, data) => {
          if (name !== 'meta') return
          try {
            const o = JSON.parse(data) as { sources?: string[] }
            ragSources.value = o.sources ?? []
          } catch {
            /* ignore */
          }
        },
      }
    )
  } catch (e: unknown) {
    if ((e as Error)?.name === 'AbortError') {
      ragError.value = acc ? '已停止生成' : null
      return
    }
    ragError.value = getErrorMessage(e)
  } finally {
    ragLoading.value = false
    ragAbort = null
  }
}

onMounted(async () => {
  await refreshHealth()
})
</script>

<template>
  <div
    class="ds-page"
    style="max-width: 45rem"
  >
    <h2 class="ds-h2">
      医学文献问答（临时 RAG · Ollama）
    </h2>
    <p
      class="ds-status lit-health"
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
      上传的文献解析、分块与向量化与「知识库」相同，向量元数据使用独立字段，仅在本临时库内检索；可多次向同一库追加文件。
    </p>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        临时文献库
      </h3>
      <p
        v-if="collectionId"
        class="lit-meta lit-meta--technical"
      >
        <span class="lit-meta__label">临时库 ID</span>
        <code class="ds-code lit-meta__code">{{ collectionId }}</code>
        <button
          type="button"
          class="ds-btn ds-btn--ghost"
          @click="newCollection"
        >
          新建空库（仅前端切换）
        </button>
        <button
          type="button"
          class="ds-btn ds-btn--danger"
          @click="purgeCollection"
        >
          删除服务端整库
        </button>
      </p>
      <p
        v-else
        class="ds-muted"
      >
        尚未上传：首次上传会自动分配临时库 ID。
      </p>
    </section>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        上传文献
      </h3>
      <div class="ds-row ds-row--center lit-upload-row">
        <label class="ds-field lit-field-inline">
          分块约长（chunkSize）
          <input
            v-model.number="chunkSize"
            class="ds-input ds-input--narrow"
            type="number"
            inputmode="numeric"
            min="128"
            max="2048"
            step="64"
          >
        </label>
        <label class="ds-file-label ds-file-label--solid lit-file-btn">
          选择文件
          <input
            type="file"
            :disabled="uploading"
            @change="onFileChange"
          >
        </label>
      </div>
      <p
        v-if="msg"
        class="ds-msg--success"
      >
        {{ msg }}
      </p>
      <p
        v-if="loadingFiles"
        class="ds-muted"
      >
        加载列表…
      </p>
      <ul
        v-else
        class="ds-list"
      >
        <li
          v-for="f in files"
          :key="f.fileUuid || f.id"
        >
          <span>{{ f.originalFilename }}</span>
          <span class="ds-muted">{{ (f.sizeBytes / 1024).toFixed(1) }} KB</span>
          <span class="ds-badge">{{ f.status }}</span>
          <button
            v-if="f.fileUuid"
            type="button"
            class="ds-link-danger"
            @click="removeFile(f.fileUuid)"
          >
            删除
          </button>
        </li>
        <li v-if="files.length === 0 && collectionId">
          <span class="ds-muted">库内暂无文件记录</span>
        </li>
      </ul>
    </section>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        文献问答
      </h3>
      <p class="ds-hint">
        流式生成（SSE），协议与知识库问答一致。
      </p>
      <textarea
        v-model="queryText"
        rows="3"
        class="ds-textarea"
        placeholder="基于已上传文献提问…"
      />
      <div class="rag-toolbar">
        <div class="rag-params">
          <label class="ds-field lit-field-inline">
            Top-K
            <input
              v-model.number="topK"
              class="ds-input ds-input--narrow"
              type="number"
              inputmode="numeric"
              min="1"
              max="20"
            >
          </label>
          <label class="ds-field lit-field-inline">
            相似度阈值（0=不过滤）
            <input
              v-model.number="threshold"
              class="ds-input ds-input--xs"
              type="number"
              inputmode="decimal"
              min="0"
              max="1"
              step="0.05"
            >
          </label>
        </div>
        <div class="rag-toolbar__actions">
          <button
            type="button"
            class="ds-btn ds-btn--primary"
            :disabled="ragLoading || !collectionId"
            @click="runQuery"
          >
            {{ ragLoading ? '生成中…' : '检索并生成' }}
          </button>
          <button
            v-if="ragLoading"
            type="button"
            class="ds-btn ds-btn--warn"
            @click="stopRag"
          >
            停止
          </button>
        </div>
      </div>
      <p
        v-if="ragError"
        class="ds-msg--error"
      >
        {{ ragError }}
      </p>
      <div
        v-if="ragAnswer"
        class="ds-answer"
      >
        <h4 class="ds-h4">
          回答
        </h4>
        <MarkdownContent
          class="ds-answer__body"
          :source="ragAnswer"
        />
        <p
          v-if="ragSources.length"
          class="ds-answer__sources"
        >
          <strong>来源：</strong>{{ ragSources.join('、') }}
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lit-health {
  margin-bottom: 0.75rem;
}
.lit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  margin: 0;
  color: var(--color-text-secondary);
}
.lit-meta--technical {
  font-size: 0.8125rem;
}
.lit-meta__label {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.lit-meta__code {
  font-size: 0.6875rem;
}
.lit-upload-row {
  margin-top: 0.5rem;
  gap: 1rem;
}
.lit-field-inline {
  flex-direction: row;
  align-items: center;
  gap: 0.65rem;
}
.lit-field-inline .ds-input--narrow {
  width: 6.5rem;
  min-width: 6.5rem;
}
.lit-file-btn {
  flex-shrink: 0;
}
.rag-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 0.75rem;
}
.rag-params {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-right: auto;
}
.rag-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}
</style>
