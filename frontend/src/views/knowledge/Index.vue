<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import type { ApiResult } from '@/types/api'
import { openSseStream } from '@/api/sse'
import type { KnowledgeBase, KnowledgeFileView } from '@/types/knowledge'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'
import MarkdownContent from '@/components/MarkdownContent.vue'

const health = ref('加载中…')
const bases = ref<KnowledgeBase[]>([])
const selectedBaseId = ref<number | null>(null)
const files = ref<KnowledgeFileView[]>([])
const loadingFiles = ref(false)
const uploading = ref(false)
const ingestMsg = ref('')
const newBaseName = ref('默认知识库')
const newBaseEmbed = ref('bge-m3:latest')
const queryText = ref('百合薏米粥适合什么体质简要说明？')
const topK = ref(4)
const ragAnswer = ref('')
const ragSources = ref<string[]>([])
const ragLoading = ref(false)
const ragError = ref<string | null>(null)
const chunkSize = ref(512)
let ragAbort: AbortController | null = null

function stopRag() {
  ragAbort?.abort()
}

async function refreshHealth() {
  try {
    const { data } = await apiClient.get<ApiResult<string>>('/v1/knowledge/health')
    health.value = formatHealthStatus(data.code, data.message ?? '')
  } catch (e) {
    health.value = getErrorMessage(e)
  }
}

async function loadBases() {
  const { data } = await apiClient.get<ApiResult<KnowledgeBase[]>>('/v1/knowledge/bases')
  if (data.code !== 0) throw new Error(data.message)
  bases.value = data.data ?? []
  if (selectedBaseId.value == null && bases.value.length > 0) {
    selectedBaseId.value = bases.value[0].id
  }
}

async function createBase() {
  ingestMsg.value = ''
  const { data } = await apiClient.post<ApiResult<KnowledgeBase>>('/v1/knowledge/bases', {
    name: newBaseName.value.trim() || '未命名知识库',
    embeddingModel: newBaseEmbed.value.trim() || 'bge-m3:latest',
  })
  if (data.code !== 0) throw new Error(data.message)
  await loadBases()
  if (data.data) selectedBaseId.value = data.data.id
  ingestMsg.value = '知识库已创建'
}

async function loadFiles() {
  if (selectedBaseId.value == null) {
    files.value = []
    return
  }
  loadingFiles.value = true
  try {
    const { data } = await apiClient.get<ApiResult<KnowledgeFileView[]>>(
      `/v1/knowledge/bases/${selectedBaseId.value}/documents`
    )
    if (data.code !== 0) throw new Error(data.message)
    files.value = data.data ?? []
  } finally {
    loadingFiles.value = false
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f || selectedBaseId.value == null) return
  uploading.value = true
  ingestMsg.value = ''
  try {
    const fd = new FormData()
    fd.append('file', f)
    if (chunkSize.value > 32) {
      fd.append('chunkSize', String(chunkSize.value))
    }
    const { data } = await apiClient.post<ApiResult<KnowledgeFileView>>(
      `/v1/knowledge/bases/${selectedBaseId.value}/documents`,
      fd
    )
    if (data.code !== 0) throw new Error(data.message)
    ingestMsg.value = `已入库：${data.data?.originalFilename ?? ''}`
    await loadFiles()
  } catch (e) {
    ingestMsg.value = getErrorMessage(e)
  } finally {
    uploading.value = false
  }
}

async function removeFile(fileUuid: string) {
  if (selectedBaseId.value == null) return
  await apiClient.delete<ApiResult<unknown>>(
    `/v1/knowledge/bases/${selectedBaseId.value}/documents/${fileUuid}`
  )
  await loadFiles()
}

async function runQuery() {
  if (selectedBaseId.value == null || !queryText.value.trim()) return
  ragLoading.value = true
  ragError.value = null
  ragAnswer.value = ''
  ragSources.value = []
  ragAbort = new AbortController()
  let acc = ''
  try {
    await openSseStream(
      `/api/v1/knowledge/bases/${selectedBaseId.value}/query/stream`,
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
          similarityThreshold: 0,
        }),
        signal: ragAbort.signal,
        onNamedEvent: (name, data) => {
          if (name !== 'meta') return
          try {
            const o = JSON.parse(data) as {
              sources?: string[]
              retrievedChunks?: number
            }
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

watch(selectedBaseId, () => {
  void loadFiles()
})

onMounted(async () => {
  await refreshHealth()
  try {
    await loadBases()
  } catch (e) {
    ingestMsg.value = getErrorMessage(e)
  }
})
</script>

<template>
  <div
    class="ds-page"
    style="max-width: 45rem"
  >
    <h2 class="ds-h2">
      中医药知识库（RAG）
    </h2>
    <p
      class="ds-status kb-health"
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

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        知识库
      </h3>
      <div class="ds-row kb-row">
        <label class="ds-field">
          当前库
          <select
            v-model.number="selectedBaseId"
            class="ds-select"
          >
            <option
              v-for="b in bases"
              :key="b.id"
              :value="b.id"
            >
              {{ b.name }} (id={{ b.id }})
            </option>
          </select>
        </label>
        <div class="kb-create">
          <input
            v-model="newBaseName"
            class="ds-input kb-input"
            placeholder="新库名称"
          >
          <input
            v-model="newBaseEmbed"
            class="ds-input kb-input"
            placeholder="Embedding 模型"
          >
          <button
            type="button"
            class="ds-btn ds-btn--primary"
            @click="createBase"
          >
            创建知识库
          </button>
        </div>
      </div>
    </section>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        上传与文档
      </h3>
      <p class="ds-hint">
        使用 Apache Tika 解析 PDF/Word/TXT 等；分块大小（token 约估）可调整。
      </p>
      <div class="ds-row ds-row--center kb-upload-row">
        <label class="ds-field kb-field-inline">
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
        <label class="ds-file-label ds-file-label--solid kb-file-btn">
          选择文件上传
          <input
            type="file"
            :disabled="uploading || selectedBaseId == null"
            @change="onFileChange"
          >
        </label>
      </div>
      <p
        v-if="ingestMsg"
        class="ds-msg--success"
      >
        {{ ingestMsg }}
      </p>
      <p
        v-if="loadingFiles"
        class="ds-muted"
      >
        加载文件列表…
      </p>
      <ul
        v-else
        class="ds-list"
      >
        <li
          v-for="f in files"
          :key="f.fileUuid"
        >
          <span>{{ f.originalFilename }}</span>
          <span class="ds-muted">{{ (f.sizeBytes / 1024).toFixed(1) }} KB</span>
          <button
            type="button"
            class="ds-link-danger"
            @click="removeFile(f.fileUuid)"
          >
            删除
          </button>
        </li>
        <li v-if="files.length === 0">
          <span class="ds-muted">暂无文件</span>
        </li>
      </ul>
    </section>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        知识问答
      </h3>
      <p class="ds-hint">
        流式生成（SSE）；来源文件在首包 meta 中展示。
      </p>
      <textarea
        v-model="queryText"
        rows="3"
        class="ds-textarea"
        placeholder="输入问题…"
      />
      <div class="rag-toolbar">
        <label class="ds-field rag-field-inline">
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
        <div class="rag-toolbar__actions">
          <button
            type="button"
            class="ds-btn ds-btn--primary"
            :disabled="ragLoading"
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
          <strong>来源文件：</strong>{{ ragSources.join('、') }}
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.kb-health {
  margin-bottom: 1.25rem;
}
.kb-row {
  align-items: center;
  margin-top: 0;
  gap: 1rem;
}
.kb-create {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  flex: 1;
  min-width: min(100%, 18rem);
}
.kb-input {
  flex: 1;
  min-width: 9rem;
}
.kb-upload-row {
  margin-top: 0.5rem;
  gap: 1rem;
}
.kb-field-inline {
  flex-direction: row;
  align-items: center;
  gap: 0.65rem;
}
.kb-field-inline .ds-input {
  width: 6.5rem;
  min-width: 6.5rem;
}
.kb-file-btn {
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
.rag-field-inline {
  margin-right: auto;
  flex-direction: row;
  align-items: center;
  gap: 0.65rem;
}
.rag-field-inline .ds-input {
  width: 5.5rem;
}
.rag-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}
</style>
