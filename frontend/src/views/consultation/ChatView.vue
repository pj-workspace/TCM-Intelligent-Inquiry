<script setup lang="ts">
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
  watch,
  nextTick,
} from 'vue'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import { getConsultationHealth } from '@/api/modules/consultation'
import type { ConsultationRagMeta, SendOptions } from '@/composables/useChat'
import ChatInputBox, {
  type ChatInputSendPayload,
} from '@/views/consultation/components/ChatInputBox.vue'
import ChatSettingsDrawer from '@/views/consultation/components/ChatSettingsDrawer.vue'
import ChatDocMessage from '@/components/business/ChatDocMessage.vue'
import DsAlert from '@/components/common/DsAlert.vue'
import { useBrailleSpinner } from '@/composables/useBrailleSpinner'
import { useConsultChatPrefs } from '@/composables/useConsultChatPrefs'
import { useOmniChatContext } from '@/composables/useOmniChatContext'
import { formatHealthStatus, isHealthStatusErr } from '@/utils/formatHealthStatus'
import {
  downloadConsultationMarkdownFile,
  downloadConsultationPdfFile,
} from '@/utils/consultExport'
import { encodeImageFileToHerbPayload } from '@/utils/herbImagePayload'
import { CONSULT_CHAT_KEY } from '@/constants/injectionKeys'

const chat = inject(CONSULT_CHAT_KEY)
if (!chat) {
  throw new Error('ConsultChatView must be mounted under ConsultationLayout')
}

const {
  messages,
  sessions,
  sessionId,
  loading,
  error,
  streamingContent,
  ragMeta,
  streamPhase,
  streamActivityLog,
  send,
  stop,
} = chat

const { knowledgeBaseId, literatureCollectionId } = useOmniChatContext()

/** 仿 claw-code CLI 分阶段进度：优先展示后端 {@code event: phase}，缺省时再用前端启发式文案 */
const { spinChar } = useBrailleSpinner(loading)
const orchestrationLabel = computed(() => {
  if (!loading.value) return ''
  const server = streamPhase.value?.label?.trim()
  if (server) return server
  const stream = streamingContent.value.trim()
  if (!stream) return '连接本地大模型…'
  return '模型流式输出中…'
})

/** 后端 phase.detail（附注）；与主标题分行展示，避免顶栏过长 */
const orchestrationDetail = computed(() => {
  if (!loading.value) return ''
  const d = streamPhase.value?.detail?.trim()
  return d ?? ''
})

const orchestrationStep = computed(() => {
  const s = streamPhase.value?.step
  if (typeof s !== 'number' || !Number.isFinite(s)) return null
  return Math.max(1, Math.floor(s))
})

const health = ref<string>('')
const threadEl = ref<HTMLElement | null>(null)
const chatInputBoxRef = ref<InstanceType<typeof ChatInputBox> | null>(null)

/** 模型参数、RAG 数值：与 ChatSettingsDrawer 共享单例 composable，见 useConsultChatPrefs */
const {
  temperature,
  topP,
  maxHistoryTurns,
  ragTopK,
  ragSimilarityThreshold,
  literatureTopK,
  literatureThreshold,
  settingsOpen,
} = useConsultChatPrefs()
const exportBusy = ref(false)
const exportHint = ref<string | null>(null)

/** 侧边栏会话标题，用于导出文件名与文档抬头 */
const currentSessionTitle = computed(() => {
  const id = sessionId.value
  if (id == null) return '问诊记录'
  return sessions.value.find((s) => s.id === id)?.title ?? `会话 #${id}`
})

let exportHintTimer: ReturnType<typeof setTimeout> | null = null
function flashExportHint(text: string) {
  exportHint.value = text
  if (exportHintTimer) clearTimeout(exportHintTimer)
  exportHintTimer = setTimeout(() => {
    exportHint.value = null
    exportHintTimer = null
  }, 4500)
}

async function onExportMarkdown() {
  const title = currentSessionTitle.value
  const streamSnap =
    loading.value && streamingContent.value ? streamingContent.value : null
  if (
    messages.value.length === 0 &&
    (streamSnap == null || streamSnap.trim() === '')
  ) {
    flashExportHint('当前没有可导出的对话内容')
    return
  }
  try {
    downloadConsultationMarkdownFile(title, messages.value, streamSnap)
    flashExportHint('已下载 Markdown 文件')
  } catch (e) {
    flashExportHint(`导出失败：${getErrorMessage(e)}`)
  }
}

async function onExportPdf() {
  const title = currentSessionTitle.value
  const streamSnap =
    loading.value && streamingContent.value ? streamingContent.value : null
  if (
    messages.value.length === 0 &&
    (streamSnap == null || streamSnap.trim() === '')
  ) {
    flashExportHint('当前没有可导出的对话内容')
    return
  }
  exportBusy.value = true
  exportHint.value = null
  try {
    // PDF 生成依赖离屏渲染与 canvas，体积大时可能阻塞片刻；按钮 loading 提升可感知性
    await downloadConsultationPdfFile(title, messages.value, streamSnap)
    flashExportHint('已生成并下载 PDF')
  } catch (e) {
    flashExportHint(`PDF 导出失败：${getErrorMessage(e)}`)
  } finally {
    exportBusy.value = false
  }
}

function formatRagLog(meta: ConsultationRagMeta | null): string | null {
  if (!meta) return null
  const lines: string[] = []
  if (meta.agentMode) {
    lines.push(`编排：${meta.agentMode}`)
  }
  if (meta.knowledgeBaseId != null) {
    lines.push(`请求侧知识库：#${meta.knowledgeBaseId}`)
  }
  if (meta.literatureCollectionId) {
    lines.push(`请求侧文献库：${meta.literatureCollectionId}`)
  }
  if (meta.knowledgeSources?.length) {
    lines.push(`知识库工具来源：${meta.knowledgeSources.join('、')}`)
  }
  if (meta.literatureSources?.length) {
    lines.push(`文献工具来源：${meta.literatureSources.join('、')}`)
  }
  lines.push(`工具命中条数（估）：${meta.retrievedChunks}`)
  if (meta.sources.length) {
    lines.push(`合并来源：${meta.sources.join('、')}`)
  }
  return lines.join('\n')
}

/** 流式输出期间收入助手折叠区，避免与顶栏 RAG 提示重复 */
const streamingRagLog = computed(() => {
  if (!loading.value || !streamingContent.value) return null
  return formatRagLog(ragMeta.value)
})

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
    const { data } = await getConsultationHealth(silentAxiosConfig)
    const line = formatHealthStatus(data.code, data.message ?? '')
    health.value = isHealthStatusErr(line) ? line : ''
  } catch (e) {
    health.value = `后端不可用: ${getErrorMessage(e)}`
  }
})

onUnmounted(() => {
  if (exportHintTimer) clearTimeout(exportHintTimer)
})

function buildSendOptions(skipAppendUser = false): SendOptions {
  const lit =
    literatureCollectionId.value.trim() === ''
      ? null
      : literatureCollectionId.value.trim()
  const opts: SendOptions = {
    temperature: temperature.value,
    topP: topP.value,
    maxHistoryTurns: maxHistoryTurns.value,
    scrollRoot: threadEl.value,
    skipAppendUser,
  }
  if (knowledgeBaseId.value != null) {
    opts.knowledgeBaseId = knowledgeBaseId.value
    opts.ragTopK = ragTopK.value
    opts.ragSimilarityThreshold = ragSimilarityThreshold.value
  }
  if (lit) {
    opts.literatureCollectionId = lit
    opts.literatureRagTopK = literatureTopK.value
    opts.literatureSimilarityThreshold = literatureThreshold.value
  }
  return opts
}

async function handleSendMessage({ text, images }: ChatInputSendPayload) {
  if (!text.trim() || loading.value) return

  const files = [...images]
  let herbPayload: { herbImageBase64?: string; herbImageMimeType?: string } =
    {}
  if (files.length > 0) {
    herbPayload = await encodeImageFileToHerbPayload(files[0]!)
  }
  const names = files.map((f) => f.name).join('、')
  const userBubbleText =
    files.length > 0
      ? `${text}\n\n（附图 ${files.length} 张：${names}；识图工具默认分析首张）`
      : undefined

  const opts = buildSendOptions(false)
  if (herbPayload.herbImageBase64) {
    opts.herbImageBase64 = herbPayload.herbImageBase64
    opts.herbImageMimeType = herbPayload.herbImageMimeType
  }
  if (userBubbleText) {
    opts.userBubbleText = userBubbleText
  }

  await send(text, opts)
  if (!error.value) chatInputBoxRef.value?.clearPendingImages()
}

async function onRegenerateAssistant() {
  if (loading.value) return
  const arr = messages.value
  if (arr.length < 2) return
  const last = arr[arr.length - 1]
  const prev = arr[arr.length - 2]
  if (last.role !== 'assistant' || prev.role !== 'user') return
  messages.value = arr.slice(0, -1)
  const bubble = prev.content.trim()
  if (!bubble) return
  /** 重新生成仅重复用户气泡原文，无法还原附图二进制，故不传 herb */
  const textForModel = bubble.includes('\n\n（附图')
    ? (bubble.split('\n\n（附图')[0] ?? bubble).trim()
    : bubble
  await send(textForModel, { ...buildSendOptions(true), userBubbleText: bubble })
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
            v-if="health"
            class="ds-status consult-header__status ds-status--err"
          >
            {{ health }}
          </p>
        </div>
        <div class="consult-header__side">
          <div
            class="consult-export-actions"
            role="group"
            aria-label="导出当前会话"
          >
            <button
              type="button"
              class="ds-btn ds-btn--ghost consult-export__btn"
              :disabled="loading || exportBusy"
              @click="onExportMarkdown"
            >
              导出 Markdown
            </button>
            <button
              type="button"
              class="ds-btn ds-btn--ghost consult-export__btn"
              :disabled="loading || exportBusy"
              @click="onExportPdf"
            >
              {{ exportBusy ? '生成 PDF…' : '导出 PDF' }}
            </button>
          </div>
          <button
            v-if="loading"
            type="button"
            class="ds-btn ds-btn--warn consult-header__stop"
            @click="stop"
          >
            停止
          </button>
          <button
            type="button"
            class="ds-btn ds-btn--icon ds-btn--subtle consult-settings__trigger"
            :aria-expanded="settingsOpen"
            aria-label="问诊设置：默认挂载与模型参数"
            title="问诊设置"
            @click="settingsOpen = true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.75"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
        </div>
      </div>
      <p
        v-if="exportHint"
        class="ds-hint consult-export-hint"
        role="status"
      >
        {{ exportHint }}
      </p>
    </header>

    <DsAlert
      v-if="error"
      variant="error"
      class="consult-alert"
    >
      {{ error }}
    </DsAlert>
    <p
      v-if="loading && orchestrationLabel"
      class="consult-orchestration"
      role="status"
      aria-live="polite"
    >
      <span class="consult-orchestration__main">
        <span
          class="consult-orchestration__spin"
          aria-hidden="true"
        >{{ spinChar }}</span>
        <span
          v-if="orchestrationStep != null"
          class="consult-orchestration__step"
        >{{ orchestrationStep }}</span>
        <span class="consult-orchestration__title">{{ orchestrationLabel }}</span>
      </span>
      <span
        v-if="orchestrationDetail"
        class="consult-orchestration__detail"
      >{{ orchestrationDetail }}</span>
    </p>
    <details
      v-if="streamActivityLog.length > 0"
      class="consult-activity-trace"
    >
      <summary class="consult-activity-trace__summary">
        编排追踪（claw-code 式阶段事件）
      </summary>
      <ol class="consult-activity-trace__list">
        <li
          v-for="(e, i) in streamActivityLog"
          :key="`${e.ts}-${i}`"
          class="consult-activity-trace__item"
          :class="{
            'consult-activity-trace__item--tool': e.phase.startsWith('tool:'),
          }"
        >
          <span
            v-if="e.step != null"
            class="consult-activity-trace__step"
          >{{ e.step }}</span>
          <code class="consult-activity-trace__phase">{{ e.phase || '—' }}</code>
          <span class="consult-activity-trace__label">{{ e.label }}</span>
          <span
            v-if="e.detail"
            class="consult-activity-trace__detail"
          >{{ e.detail }}</span>
        </li>
      </ol>
    </details>
    <p
      v-if="ragMeta && !(loading && streamingContent)"
      class="ds-hint consult-rag-meta"
    >
      <template v-if="ragMeta.agentMode === 'react+tools'">
        本回合 Agent 工具链已运行（{{ ragMeta.agentMode }}）。工具侧约
        {{ ragMeta.retrievedChunks }} 条命中<span
          v-if="ragMeta.sources.length"
        >；合并来源：{{ ragMeta.sources.join('、') }}</span>。
      </template>
      <template v-else-if="ragMeta.literatureCollectionId">
        本回合已关联文献库（ID {{ ragMeta.literatureCollectionId }}），检索到
        {{ ragMeta.retrievedChunks }} 条相关片段<span
          v-if="ragMeta.sources.length"
        >；来源：{{ ragMeta.sources.join('、') }}</span>。
      </template>
      <template v-else-if="ragMeta.knowledgeBaseId != null">
        本回合已关联知识库 #{{ ragMeta.knowledgeBaseId }}，检索到
        {{ ragMeta.retrievedChunks }} 条相关片段<span
          v-if="ragMeta.sources.length"
        >；来源：{{ ragMeta.sources.join('、') }}</span>。
      </template>
      <template v-else>
        检索到 {{ ragMeta.retrievedChunks }} 条相关片段<span
          v-if="ragMeta.sources.length"
        >；来源：{{ ragMeta.sources.join('、') }}</span>。
      </template>
    </p>

    <div
      ref="threadEl"
      class="ds-thread consult-thread"
      role="region"
      aria-label="对话内容"
    >
      <div class="consult-doc-stream">
        <div
          v-if="messages.length === 0 && !loading && !streamingContent"
          class="ds-thread-empty"
        >
          <p class="ds-thread-empty__title">
            开始一次问诊
          </p>
          <p class="ds-thread-empty__hint">
            Enter 发送，Shift+Enter 换行。输入区旁可附药材 / 舌象图（走识图工具）；右上角可设置可选默认知识库与文献库。
          </p>
        </div>
        <ChatDocMessage
          v-for="(m, i) in messages"
          :key="i"
          :role="m.role"
          :content="m.content"
          :allow-regenerate="
            m.role === 'assistant' &&
              i === messages.length - 1 &&
              !loading
          "
          @regenerate="onRegenerateAssistant"
        />
        <ChatDocMessage
          v-if="loading"
          role="assistant"
          :content="streamingContent"
          :rag-log="streamingRagLog"
          :is-streaming="true"
          :stream-vision="false"
          :allow-regenerate="false"
        />
      </div>
    </div>

    <ChatInputBox
      ref="chatInputBoxRef"
      :loading="loading"
      @send="handleSendMessage"
    />

    <ChatSettingsDrawer
      v-model:visible="settingsOpen"
      :loading="loading"
    />
  </div>
</template>

<style scoped>
.consult-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  background: transparent;
}

.consult-orchestration {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.28rem;
  margin: 0 0 0.5rem;
  padding: 0.4rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-muted);
  background: rgba(99, 102, 241, 0.07);
  border-radius: 0.45rem;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.consult-orchestration__main {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.consult-orchestration__title {
  min-width: 0;
}

.consult-orchestration__step {
  flex-shrink: 0;
  min-width: 1.25rem;
  padding: 0.08rem 0.35rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.14);
  border-radius: 0.3rem;
}

.consult-orchestration__detail {
  margin: 0;
  padding-left: calc(1rem + 0.45rem);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.45;
  color: var(--color-muted);
  opacity: 0.92;
  word-break: break-word;
}

.consult-orchestration__spin {
  display: inline-block;
  flex-shrink: 0;
  width: 1rem;
  text-align: center;
  font-family: ui-monospace, monospace;
  color: var(--color-primary-hover);
}

.consult-activity-trace {
  margin: 0 0 0.5rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  color: var(--color-muted);
  background: rgba(15, 23, 42, 0.04);
  border-radius: 0.4rem;
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.consult-activity-trace__summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text);
  list-style: none;
}

.consult-activity-trace__summary::-webkit-details-marker {
  display: none;
}

.consult-activity-trace__list {
  margin: 0.4rem 0 0;
  padding-left: 1.15rem;
}

.consult-activity-trace__item {
  margin-bottom: 0.28rem;
  line-height: 1.4;
  word-break: break-word;
}

.consult-activity-trace__item--tool {
  padding-left: 0.15rem;
  border-left: 2px solid rgba(34, 197, 94, 0.55);
}

.consult-activity-trace__step {
  display: inline-block;
  margin-right: 0.35rem;
  padding: 0 0.28rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.12);
  border-radius: 0.25rem;
  vertical-align: middle;
}

.consult-activity-trace__phase {
  margin-right: 0.35rem;
  padding: 0.06rem 0.28rem;
  font-size: 0.68rem;
  background: rgba(99, 102, 241, 0.08);
  border-radius: 0.25rem;
}

.consult-activity-trace__label {
  font-weight: 500;
  color: var(--color-text);
}

.consult-activity-trace__detail {
  display: block;
  margin-top: 0.12rem;
  margin-left: 0;
  padding-left: 0.15rem;
  opacity: 0.88;
  font-weight: 400;
}

.consult-header {
  flex-shrink: 0;
  margin-bottom: 0.35rem;
}

.consult-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.consult-header__main {
  min-width: 0;
  flex: 1;
  text-align: left;
}

.consult-header__title {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.35;
}

.consult-header__status {
  margin: 0.35rem 0 0;
  width: fit-content;
  max-width: 100%;
}

.consult-header__side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}

.consult-export-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.consult-export__btn {
  font-size: 0.82rem;
  padding: 0.35rem 0.55rem;
}

.consult-export-hint {
  margin: 0.5rem 0 0;
  width: 100%;
}

.consult-settings__trigger {
  min-width: var(--ds-control-height);
}

.consult-header__stop {
  font-size: 0.8125rem;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.consult-rag-meta {
  margin-top: 0.25rem;
  margin-bottom: 0;
  font-size: 0.8125rem;
}

.consult-alert {
  margin: 0.5rem 0 0.35rem;
  max-width: min(100%, 40rem);
}

.consult-thread {
  flex: 1;
  min-height: 0;
}

.consult-doc-stream {
  width: 100%;
  max-width: 48rem;
  margin: 0 auto;
  padding: 0 0.35rem 1.5rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1;
  min-height: 0;
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
