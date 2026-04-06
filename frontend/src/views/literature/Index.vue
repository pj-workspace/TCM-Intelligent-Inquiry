<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave } from 'vue-router'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import { openSseStream } from '@/api/core/sse'
import { validateIngestChunkParams } from '@/utils/chunkUploadParams'
import MarkdownContent from '@/components/business/MarkdownContent.vue'
import {
  deleteLiteratureCollection,
  deleteLiteratureDocument,
  getLiteratureHealth,
  listLiteratureCollectionFiles,
  literatureQueryStreamUrl,
  uploadLiteratureFile,
} from '@/api/modules/literature'
import DsAlert from '@/components/common/DsAlert.vue'
import type { LiteratureFileView, LiteratureQueryResponse } from '@/types/literature'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'
import {
  LITERATURE_TAB_COLLECTION_SESSION_KEY,
  setLiteratureTabCollectionId,
} from '@/utils/literatureBeacon'

const health = ref('加载中…')
const collectionId = ref<string | null>(null)
const files = ref<LiteratureFileView[]>([])
const loadingFiles = ref(false)
const uploading = ref(false)
const msg = ref('')
const chunkSize = ref(512)
/** 与知识库相同：>0 时滑动窗口（码点），chunkSize 为窗口长度 */
const chunkOverlap = ref(0)

/** —— 检索试答：调用临时库非流式 query，不经过问诊会话，便于上传后立即验召回 —— */
const probeQuestion = ref('')
const probeTopK = ref(4)
const probeSimilarity = ref(0)
const probeLoading = ref(false)
const probeError = ref<string | null>(null)
const probeAnswer = ref<LiteratureQueryResponse | null>(null)
const probeStreamText = ref('')
const probePhaseLabel = ref<string | null>(null)
let probeAbort: AbortController | null = null

async function refreshHealth() {
  try {
    const { data } = await getLiteratureHealth(silentAxiosConfig)
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
    const { data } = await listLiteratureCollectionFiles(
      collectionId.value,
      silentAxiosConfig
    )
    if (data.code !== 0) throw new Error(data.message)
    files.value = data.data ?? []
  } finally {
    loadingFiles.value = false
  }
}

watch(collectionId, () => {
  void loadFiles()
  // 切换或清空临时库时丢弃上一次试答，避免将旧库的答案发在新库上下文下误读
  probeAnswer.value = null
  probeError.value = null
  probeStreamText.value = ''
  probePhaseLabel.value = null
})

/**
 * 与 sessionStorage 同步：非空则记录到本标签页（供 pagehide + sendBeacon 释放）；
 * 从「有值」变为空时清除（显式删库 / 新建空库 / 路由守卫删库后）。
 * 初次进入页面且 ref 为空时，不覆盖 storage，以便保留「保留并离开」后的 ID 供恢复或关页释放。
 */
watch(collectionId, (v, oldV) => {
  if (v) {
    setLiteratureTabCollectionId(v)
  } else if (oldV != null) {
    setLiteratureTabCollectionId(null)
  }
})

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const list = input.files
  input.value = ''
  if (!list?.length) return
  const paramErr = validateIngestChunkParams(chunkSize.value, chunkOverlap.value)
  if (paramErr) {
    ElMessage.error(paramErr)
    return
  }
  uploading.value = true
  msg.value = ''
  const total = list.length
  let currentColl = collectionId.value
  const errors: string[] = []
  let ok = 0
  try {
    for (let i = 0; i < total; i++) {
      const f = list[i]!
      if (total > 1) {
        msg.value = `上传中 ${i + 1}/${total}：${f.name}…`
      }
      try {
        const fd = new FormData()
        fd.append('file', f)
        if (currentColl) {
          fd.append('collectionId', currentColl)
        }
        if (chunkSize.value > 32) {
          fd.append('chunkSize', String(chunkSize.value))
        }
        if (chunkOverlap.value > 0) {
          fd.append('chunkOverlap', String(chunkOverlap.value))
        }
        const { data } = await uploadLiteratureFile(fd, silentAxiosConfig)
        if (data.code !== 0) throw new Error(data.message)
        const row = data.data
        if (row?.tempCollectionId) {
          currentColl = row.tempCollectionId
          collectionId.value = currentColl
        }
        ok++
      } catch (err) {
        errors.push(`${f.name}：${getErrorMessage(err)}`)
      }
    }
    await loadFiles()
    if (errors.length === 0) {
      msg.value =
        total === 1 && list[0]
          ? `已解析入库：${list[0].name}`
          : `已依次入库 ${ok} 个文件`
    } else {
      msg.value =
        ok > 0
          ? `部分失败（成功 ${ok}/${total}）\n${errors.join('\n')}`
          : errors.join('\n')
    }
  } finally {
    uploading.value = false
  }
}

async function removeFile(fileUuid: string) {
  if (!collectionId.value) return
  if (!confirm('确定从当前文献库删除此文件及其向量？')) return
  await deleteLiteratureDocument(
    collectionId.value,
    fileUuid,
    silentAxiosConfig
  )
  await loadFiles()
}

async function purgeCollection() {
  if (!collectionId.value) return
  if (!confirm('确定删除当前临时文献库及其向量？')) return
  await deleteLiteratureCollection(collectionId.value, silentAxiosConfig)
  collectionId.value = null
  files.value = []
  msg.value = '已清空临时库'
}

async function newCollection() {
  collectionId.value = null
  files.value = []
  msg.value = '请上传首个文件，将自动新建临时文献库'
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * 对当前临时库发起 SSE 流式 RAG 试答（phase / meta 与知识库 stream 一致）。
 */
async function runLiteratureProbe() {
  const cid = collectionId.value?.trim()
  if (!cid) {
    ElMessage.warning('请先上传文献以创建临时库，或从 session 恢复已有库')
    return
  }
  const q = probeQuestion.value.trim()
  if (!q) {
    ElMessage.warning('请输入试答问题')
    return
  }
  probeAbort?.abort()
  probeAbort = new AbortController()
  probeLoading.value = true
  probeError.value = null
  probeAnswer.value = null
  probeStreamText.value = ''
  probePhaseLabel.value = null
  let retrievedChunks = 0
  let sources: string[] = []
  try {
    await openSseStream(
      literatureQueryStreamUrl(cid),
      (chunk) => {
        probeStreamText.value += chunk
      },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          topK: probeTopK.value,
          similarityThreshold: probeSimilarity.value,
        }),
        signal: probeAbort.signal,
        onNamedEvent: (name, data) => {
          if (name === 'phase') {
            try {
              const o = JSON.parse(data) as { label?: string }
              if (typeof o.label === 'string') probePhaseLabel.value = o.label
            } catch {
              /* ignore */
            }
            return
          }
          if (name === 'meta') {
            try {
              const o = JSON.parse(data) as {
                sources?: string[]
                retrievedChunks?: number
              }
              if (Array.isArray(o.sources)) sources = o.sources
              if (typeof o.retrievedChunks === 'number') {
                retrievedChunks = o.retrievedChunks
              }
            } catch {
              /* ignore */
            }
          }
        },
      }
    )
    probeAnswer.value = {
      answer: probeStreamText.value,
      sources,
      retrievedChunks,
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      probeError.value = null
    } else {
      probeError.value = getErrorMessage(e)
    }
  } finally {
    probeLoading.value = false
    probePhaseLabel.value = null
    probeAbort = null
  }
}

/** 同库各行 expiresAt 对齐，取首条展示即可 */
const collectionExpiresLabel = computed(() => {
  const row = files.value.find((f) => f.expiresAt)
  if (!row?.expiresAt) return ''
  return `当前临时库向量与文件计划在 ${formatDate(row.expiresAt)} 自动清理（任一新上传会将整库有效期顺延）。`
})

onMounted(async () => {
  if (!collectionId.value) {
    try {
      const raw = sessionStorage.getItem(LITERATURE_TAB_COLLECTION_SESSION_KEY)
      const trimmed = raw?.trim()
      if (trimmed) {
        collectionId.value = trimmed
      }
    } catch {
      /* ignore */
    }
  }
  await refreshHealth()
})

/**
 * 离开文献管理路由时：若存在活跃临时库，提示是否立即删除服务端向量与元数据（否则仍依赖 TTL）。
 * 上传进行中禁止跳转，避免半途中断导致状态不一致。
 */
onBeforeRouteLeave(async (_to, _from, next) => {
  if (uploading.value) {
    ElMessage.warning('正在上传文献，请等待完成后再切换页面')
    next(false)
    return
  }
  const cid = collectionId.value
  if (!cid) {
    next()
    return
  }
  try {
    await ElMessageBox.confirm(
      '当前已关联临时文献库，向量仍占用 Redis 与服务端元数据（至 TTL 或定时任务清理）。离开本页前是否立即删除整库？',
      '离开文献管理',
      {
        distinguishCancelAndClose: true,
        confirmButtonText: '删除服务端整库并离开',
        cancelButtonText: '保留临时库并离开',
        type: 'warning',
      }
    )
    try {
      await deleteLiteratureCollection(cid, silentAxiosConfig)
      collectionId.value = null
      files.value = []
    } catch (e) {
      ElMessage.error(getErrorMessage(e))
      next(false)
      return
    }
    next()
  } catch (action: unknown) {
    if (action === 'cancel') {
      next()
      return
    }
    next(false)
  }
})
</script>

<template>
  <div
    class="ds-page lit-page"
  >
    <h2 class="ds-h2">
      文献库管理
    </h2>
    <p class="ds-lead lit-lead">
      上传与解析文献向量（进入 Redis Stack，与知识库 metadata 隔离）；服务端按配置对临时库做 TTL
      滑动续期与定时清理。下方「检索试答」可在本页单次验库。问诊请选择「文献库」模式并指定本页临时库 ID。若当前已建临时库，切换到其它路由时会询问是否立即删除服务端整库（亦可保留至 TTL）；关闭或刷新本标签页时会尽力通过浏览器 Beacon 通知服务端释放（与 TTL 互补）。
    </p>
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
      <p
        v-if="collectionExpiresLabel"
        class="ds-hint lit-ttl-hint"
      >
        {{ collectionExpiresLabel }}
      </p>
    </section>

    <section class="ds-card lit-probe-card">
      <h3 class="ds-h3 ds-card__title">
        检索试答
      </h3>
      <p class="ds-hint lit-probe-hint">
        走临时库 SSE 流式 RAG（phase / meta），便于观察检索与生成；0 表示相似度阈值不过滤。结果不写入问诊会话。
      </p>
      <label class="ds-field lit-probe-field">
        试答问题
        <textarea
          v-model="probeQuestion"
          class="ds-textarea lit-probe-textarea"
          rows="3"
          placeholder="例如：摘要中提到的方剂组成是什么？"
          :disabled="probeLoading || !collectionId"
          aria-label="文献临时库试答问题"
        />
      </label>
      <div class="ds-row lit-probe-row">
        <label class="ds-field lit-field-inline">
          topK
          <input
            v-model.number="probeTopK"
            class="ds-input ds-input--narrow"
            type="number"
            min="1"
            max="20"
            step="1"
            :disabled="probeLoading || !collectionId"
          >
        </label>
        <label class="ds-field lit-field-inline">
          相似度阈值（0=不过滤）
          <input
            v-model.number="probeSimilarity"
            class="ds-input ds-input--narrow"
            type="number"
            inputmode="decimal"
            min="0"
            max="1"
            step="0.05"
            :disabled="probeLoading || !collectionId"
          >
        </label>
        <button
          type="button"
          class="ds-btn ds-btn--primary lit-probe-btn"
          :disabled="probeLoading || !collectionId"
          @click="runLiteratureProbe"
        >
          {{ probeLoading ? '生成中…' : '发起试答' }}
        </button>
      </div>
      <DsAlert
        v-if="probeError"
        class="lit-probe-alert"
      >
        {{ probeError }}
      </DsAlert>
      <p
        v-if="probeLoading && probePhaseLabel"
        class="lit-probe-phase"
        role="status"
        aria-live="polite"
      >
        {{ probePhaseLabel }}
      </p>
      <div
        v-if="probeLoading && probeStreamText"
        class="lit-probe-answer lit-probe-answer--stream"
      >
        <MarkdownContent :source="probeStreamText" />
      </div>
      <div
        v-else-if="probeLoading"
        class="lit-probe-skeleton"
        role="status"
        aria-busy="true"
        aria-label="试答生成中"
      >
        <div class="lit-probe-skeleton__line" />
        <div class="lit-probe-skeleton__line lit-probe-skeleton__line--mid" />
        <div class="lit-probe-skeleton__line lit-probe-skeleton__line--short" />
      </div>
      <div
        v-else-if="probeAnswer"
        class="lit-probe-result"
      >
        <p class="lit-probe-meta">
          召回片段：{{ probeAnswer.retrievedChunks }} 条
          <template v-if="probeAnswer.sources?.length">
            ；来源：{{ probeAnswer.sources.join('、') }}
          </template>
        </p>
        <div class="lit-probe-answer">
          <MarkdownContent :source="probeAnswer.answer" />
        </div>
      </div>
    </section>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        上传文献
      </h3>
      <p class="ds-hint lit-upload-hint">
        可多选文件依次解析；同一批上传会共享当前临时库 ID（首批会自动建库）。重叠为 0 时按 Token 分块；重叠
        &gt;0 时按码点滑动窗口（参数含义与知识库页一致）。
      </p>
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
        <label class="ds-field lit-field-inline">
          重叠（chunkOverlap）
          <input
            v-model.number="chunkOverlap"
            class="ds-input ds-input--narrow"
            type="number"
            inputmode="numeric"
            min="0"
            max="1024"
            step="32"
            title="0=Token 切分；>0=码点滑动窗口"
          >
        </label>
        <label class="ds-file-label ds-file-label--solid lit-file-btn">
          选择文件
          <input
            type="file"
            multiple
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
      <div
        v-if="loadingFiles"
        class="lit-skeleton"
        role="status"
        aria-busy="true"
        aria-label="正在加载文献列表"
      >
        <div class="lit-skeleton__row" />
        <div class="lit-skeleton__row lit-skeleton__row--short" />
        <div class="lit-skeleton__row" />
      </div>
      <div
        v-else
        class="lit-table-wrap"
      >
        <table
          class="lit-table"
          aria-label="文献文件"
        >
          <thead>
            <tr>
              <th scope="col">
                文档名
              </th>
              <th scope="col">
                大小
              </th>
              <th scope="col">
                解析状态
              </th>
              <th scope="col">
                上传时间
              </th>
              <th scope="col">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="f in files"
              :key="f.fileUuid || String(f.id)"
            >
              <td>{{ f.originalFilename }}</td>
              <td>{{ (f.sizeBytes / 1024).toFixed(1) }} KB</td>
              <td>
                <span class="ds-badge">{{ f.status }}</span>
              </td>
              <td class="lit-table__mono">
                {{ formatDate(f.createdAt) }}
              </td>
              <td>
                <button
                  v-if="f.fileUuid"
                  type="button"
                  class="ds-link-danger"
                  @click="removeFile(f.fileUuid)"
                >
                  删除
                </button>
                <span
                  v-else
                  class="ds-muted"
                >—</span>
              </td>
            </tr>
            <tr v-if="files.length === 0">
              <td
                colspan="5"
                class="lit-table-empty"
              >
                <div
                  class="lit-empty"
                  role="status"
                >
                  <svg
                    class="lit-empty__icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                  <p class="lit-empty__title">
                    {{ collectionId ? '库内暂无文件' : '暂无文件' }}
                  </p>
                  <p class="lit-empty__hint">
                    {{
                      collectionId
                        ? '可在上方「选择文件」继续添加文献'
                        : '上传首个文件将自动创建临时文献库，也可点击上方「选择文件」开始'
                    }}
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lit-page {
  max-width: 56rem;
}
.lit-lead {
  margin-top: -0.25rem;
  margin-bottom: 0.75rem;
  max-width: 42rem;
}
.lit-health {
  margin-bottom: 0.75rem;
}
.lit-probe-card {
  margin-top: 0;
}
.lit-probe-hint {
  margin-top: -0.15rem;
}
.lit-probe-field {
  margin-top: 0.65rem;
  max-width: min(100%, 40rem);
}
.lit-probe-textarea {
  margin-top: 0.35rem;
  width: 100%;
  max-width: min(100%, 40rem);
}
.lit-probe-row {
  margin-top: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
}
.lit-probe-btn {
  flex-shrink: 0;
}
.lit-probe-alert {
  margin-top: 0.75rem;
}
.lit-probe-phase {
  margin: 0.75rem 0 0;
  padding: 0.4rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-muted);
  background: rgba(99, 102, 241, 0.07);
  border-radius: 0.45rem;
  border: 1px solid rgba(99, 102, 241, 0.15);
}
.lit-probe-skeleton {
  margin-top: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.lit-probe-skeleton__line {
  height: 1rem;
  border-radius: 0.35rem;
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 0%,
    var(--color-border) 50%,
    var(--color-surface-elevated) 100%
  );
  background-size: 200% 100%;
  animation: lit-shimmer 1.2s ease-in-out infinite;
}
.lit-probe-skeleton__line--mid {
  width: 92%;
}
.lit-probe-skeleton__line--short {
  width: 55%;
}
.lit-probe-result {
  margin-top: 0.85rem;
  padding: 0.85rem 1rem;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}
.lit-probe-meta {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
  color: var(--color-muted);
  line-height: 1.45;
}
.lit-probe-answer {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-text);
}
.lit-probe-answer--stream {
  margin-top: 0.65rem;
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
  background: rgba(99, 102, 241, 0.05);
  border: 1px dashed rgba(99, 102, 241, 0.22);
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
.lit-skeleton {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.lit-skeleton__row {
  height: 2.25rem;
  border-radius: 0.5rem;
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 0%,
    var(--color-border) 50%,
    var(--color-surface-elevated) 100%
  );
  background-size: 200% 100%;
  animation: lit-shimmer 1.2s ease-in-out infinite;
}
.lit-skeleton__row--short {
  width: 70%;
}
@keyframes lit-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
.lit-table-wrap {
  margin-top: 0.75rem;
  overflow-x: auto;
}
.lit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.lit-table th,
.lit-table td {
  text-align: left;
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid var(--color-border);
}
.lit-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.lit-table__mono {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  color: var(--color-muted);
}
.lit-table-empty {
  padding: 0;
  border-bottom: none;
  vertical-align: middle;
}
.lit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1.25rem 2.25rem;
  color: var(--color-muted);
}
.lit-empty__icon {
  color: var(--color-border-strong);
  margin-bottom: 0.65rem;
}
.lit-empty__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.lit-empty__hint {
  margin: 0.35rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  max-width: 24rem;
}
</style>
