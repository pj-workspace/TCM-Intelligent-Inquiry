<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage } from '@/api/core/errors'
import { openSseStream } from '@/api/core/sse'
import { literatureQueryStreamUrl } from '@/api/modules/literature'
import MarkdownContent from '@/components/business/MarkdownContent.vue'
import DsAlert from '@/components/common/DsAlert.vue'
import type { LiteratureQueryResponse } from '@/types/literature'

const props = defineProps<{
  collectionId: string | null
}>()

const probeQuestion = ref('')
const probeTopK = ref(4)
const probeSimilarity = ref(0)
const probeLoading = ref(false)
const probeError = ref<string | null>(null)
const probeAnswer = ref<LiteratureQueryResponse | null>(null)
const probeStreamText = ref('')
const probePhaseLabel = ref<string | null>(null)
let probeAbort: AbortController | null = null

watch(
  () => props.collectionId,
  () => {
    probeAbort?.abort()
    probeAbort = null
    probeAnswer.value = null
    probeError.value = null
    probeStreamText.value = ''
    probePhaseLabel.value = null
  }
)

/**
 * 对当前临时库发起 SSE 流式 RAG 试答（phase / meta 与知识库 stream 一致）。
 */
async function startProbeQuery() {
  const cid = props.collectionId?.trim()
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
              const o = JSON.parse(data) as { label?: string; detail?: string }
              if (typeof o.label === 'string') {
                const d =
                  typeof o.detail === 'string' && o.detail.trim() !== ''
                    ? o.detail.trim()
                    : ''
                probePhaseLabel.value = d ? `${o.label} — ${d}` : o.label
              }
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
</script>

<template>
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
        @click="startProbeQuery"
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
</template>

<style scoped>
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
  animation: lit-probe-shimmer 1.2s ease-in-out infinite;
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
.lit-field-inline {
  flex-direction: row;
  align-items: center;
  gap: 0.65rem;
}
.lit-field-inline .ds-input--narrow {
  width: 6.5rem;
  min-width: 6.5rem;
}
@keyframes lit-probe-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
