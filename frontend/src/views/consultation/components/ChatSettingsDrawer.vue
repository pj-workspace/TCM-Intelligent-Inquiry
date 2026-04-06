<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { silentAxiosConfig } from '@/api/core/client'
import { getAgentConfig } from '@/api/modules/agent'
import { listKnowledgeBases } from '@/api/modules/knowledge'
import { listLiteratureUploads } from '@/api/modules/literature'
import type { KnowledgeBase } from '@/types/knowledge'
import DsSelect from '@/components/common/DsSelect.vue'
import type { DsSelectOption } from '@/components/common/DsSelect.vue'
import { useConsultChatPrefs } from '@/composables/useConsultChatPrefs'
import { useOmniChatContext } from '@/composables/useOmniChatContext'
import { LITERATURE_TAB_COLLECTION_SESSION_KEY } from '@/utils/literatureBeacon'

const visible = defineModel<boolean>('visible', { required: true })

defineProps<{
  loading: boolean
}>()

const {
  temperature,
  topP,
  maxHistoryTurns,
  ragTopK,
  ragSimilarityThreshold,
  literatureTopK,
  literatureThreshold,
  advOpen,
  onConsultAdvToggle,
} = useConsultChatPrefs()

const { knowledgeBaseId, literatureCollectionId } = useOmniChatContext()

const knowledgeBases = ref<KnowledgeBase[]>([])
const literatureCollections = ref<{ id: string; label: string }[]>([])

const knowledgeSelectOptions = computed<DsSelectOption[]>(() => {
  const head: DsSelectOption[] = [{ value: null, label: '不指定' }]
  return [
    ...head,
    ...knowledgeBases.value.map((b) => ({
      value: b.id as number,
      label: b.name,
    })),
  ]
})

const literatureSelectOptions = computed<DsSelectOption[]>(() => {
  const head: DsSelectOption[] = [{ value: '', label: '不指定' }]
  return [
    ...head,
    ...literatureCollections.value.map((c) => ({
      value: c.id,
      label: c.label,
    })),
  ]
})

async function loadKnowledgeBases() {
  try {
    const { data } = await listKnowledgeBases(silentAxiosConfig)
    if (data.code !== 0) return
    knowledgeBases.value = data.data ?? []
  } catch {
    /* 知识库不可用时仍可纯问诊 */
  }
}

async function loadLiteratureCollections() {
  try {
    const { data } = await listLiteratureUploads(silentAxiosConfig)
    if (data.code !== 0) return
    const files = data.data ?? []
    const seen = new Set<string>()
    const rows: { id: string; label: string }[] = []
    for (const f of files) {
      const cid = f.tempCollectionId?.trim()
      if (!cid || seen.has(cid)) continue
      seen.add(cid)
      const short = cid.length > 12 ? `${cid.slice(0, 10)}…` : cid
      rows.push({ id: cid, label: `文献库 ${short}` })
    }
    literatureCollections.value = rows
  } catch {
    literatureCollections.value = []
  }
}

async function loadAgentDefaults() {
  try {
    const { data } = await getAgentConfig(silentAxiosConfig)
    if (data.code !== 0 || !data.data) return
    const kb = data.data.defaultKnowledgeBaseId
    if (kb != null && knowledgeBaseId.value == null) {
      knowledgeBaseId.value = kb
    }
  } catch {
    /* optional */
  }
}

onMounted(() => {
  try {
    if (!literatureCollectionId.value.trim()) {
      const b = sessionStorage.getItem(LITERATURE_TAB_COLLECTION_SESSION_KEY)
      if (b?.trim()) {
        literatureCollectionId.value = b.trim()
      }
    }
  } catch {
    /* ignore */
  }
  void loadKnowledgeBases()
  void loadLiteratureCollections()
  void loadAgentDefaults()
})
</script>

<template>
  <el-drawer
    v-model="visible"
    class="chat-settings-drawer"
    title="问诊设置"
    direction="rtl"
    append-to-body
  >
    <div class="chat-settings-drawer__body">
      <div class="omni-bar omni-bar--panel">
        <p class="omni-vision-note omni-vision-note--compact">
          本轮由后端 Agent 按需调用知识库、文献与识图工具；无需再选手动模式。可选填默认挂载（亦为模型 ToolContext 默认值）。
        </p>

        <div
          v-if="knowledgeBases.length > 0"
          class="omni-bar__mount"
        >
          <label class="omni-mount-label">
            默认知识库（可选）
            <DsSelect
              v-model="knowledgeBaseId"
              class="omni-select"
              :options="knowledgeSelectOptions"
              placeholder="不指定则仅智能体配置中的默认库"
              :disabled="loading"
              aria-label="默认知识库"
            />
          </label>
        </div>
        <div
          v-else
          class="omni-hint"
        >
          暂无知识库；可在「知识库」页创建后在此指定默认库。
        </div>

        <div class="omni-bar__mount omni-bar__mount--literature">
          <label class="omni-mount-label omni-mount-label--grow">
            默认文献库（可选）
            <DsSelect
              v-model="literatureCollectionId"
              class="omni-select"
              :options="literatureSelectOptions"
              placeholder="可选；文献页会自动写入 session"
              :disabled="loading"
              aria-label="默认文献库"
            />
          </label>
          <button
            type="button"
            class="ds-btn ds-btn--ghost omni-refresh"
            :disabled="loading"
            @click="loadLiteratureCollections"
          >
            刷新列表
          </button>
        </div>
      </div>

      <details
        class="consult-adv consult-adv--panel"
        :open="advOpen"
        @toggle="onConsultAdvToggle"
      >
        <summary class="consult-adv__summary">
          模型、RAG 参数与上下文
        </summary>
        <div class="consult-adv__body">
          <p class="consult-slider-intro ds-hint">
            以下三项支持滑条与数值框联动（企业级 SaaS 常见交互），便于快速扫参。
          </p>
          <div class="consult-slider-grid">
            <div class="consult-slider-item">
              <div class="consult-slider-item__label">
                Temperature
              </div>
              <el-slider
                v-model="temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :show-input="true"
                :disabled="loading"
                input-size="small"
                class="consult-el-slider"
              />
            </div>
            <div class="consult-slider-item">
              <div class="consult-slider-item__label">
                Top-P
              </div>
              <el-slider
                v-model="topP"
                :min="0.05"
                :max="1"
                :step="0.05"
                :show-input="true"
                :disabled="loading"
                input-size="small"
                class="consult-el-slider"
              />
            </div>
            <div class="consult-slider-item">
              <div class="consult-slider-item__label">
                历史轮数上限
              </div>
              <el-slider
                v-model="maxHistoryTurns"
                :min="1"
                :max="50"
                :step="1"
                :show-input="true"
                :disabled="loading"
                input-size="small"
                class="consult-el-slider"
              />
            </div>
          </div>
          <div class="consult-controls consult-controls--wrap consult-controls--rag">
            <label class="ds-field">
              知识库 RAG topK
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
            <label class="ds-field">
              知识库相似度
              <input
                v-model.number="ragSimilarityThreshold"
                class="ds-input ds-input--narrow"
                type="number"
                inputmode="decimal"
                min="0"
                max="1"
                step="0.05"
                :disabled="loading"
              >
            </label>
            <label class="ds-field">
              文献 topK
              <input
                v-model.number="literatureTopK"
                class="ds-input ds-input--narrow"
                type="number"
                min="1"
                max="20"
                step="1"
                :disabled="loading"
              >
            </label>
            <label class="ds-field">
              文献相似度（0=不过滤）
              <input
                v-model.number="literatureThreshold"
                class="ds-input ds-input--narrow"
                type="number"
                inputmode="decimal"
                min="0"
                max="1"
                step="0.05"
                :disabled="loading"
              >
            </label>
          </div>
        </div>
      </details>
    </div>
  </el-drawer>
</template>

<style scoped>
.chat-settings-drawer__body {
  padding: 0 0 1rem;
  box-sizing: border-box;
}

.omni-bar--panel {
  margin: 0 0 0.75rem;
}

.omni-bar {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.omni-bar__mount {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.65rem;
  width: 100%;
}

.omni-bar__mount--literature {
  align-items: flex-end;
}

.omni-mount-label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.omni-mount-label--grow {
  flex: 1 1 12rem;
  min-width: 0;
}

.omni-select {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.omni-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.omni-vision-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
  max-width: none;
}

.omni-vision-note--compact {
  margin-bottom: 0.5rem;
}

.omni-refresh {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  flex-shrink: 0;
}

.consult-adv--panel {
  margin: 0;
}

.consult-adv--panel .consult-adv__body {
  margin-top: 0.35rem;
  padding-top: 0.45rem;
  border-top: 1px dashed var(--color-border-neutral);
}

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
  padding: 0.1rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-muted);
  border: none;
  background: transparent;
  touch-action: manipulation;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease, transform 0.1s ease, background-color 0.15s ease;
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

.consult-adv__summary:active {
  transform: scale(0.98);
  background: rgba(124, 58, 237, 0.06);
}

.consult-adv__summary:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.consult-adv__body {
  margin-top: 0.35rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--color-border);
}

.consult-slider-intro {
  margin: 0 0 0.65rem;
  max-width: none;
}

.consult-slider-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 0.75rem;
  width: 100%;
}

.consult-slider-item__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.3rem;
}

.consult-el-slider {
  width: 100%;
}

.consult-controls--rag {
  margin-top: 0.15rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem 0.85rem;
  width: 100%;
}

.consult-controls {
  margin-top: 0;
}

.consult-controls--wrap {
  flex-wrap: wrap;
}

.consult-controls--rag .ds-field {
  min-width: 0;
}

@media (max-width: 22rem) {
  .consult-controls--rag {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
/* 抽屉挂到 body，需非 scoped：响应式宽度 + 内部滚动 */
.chat-settings-drawer.el-drawer {
  width: min(90vw, 400px) !important;
}

.chat-settings-drawer .el-drawer__body {
  padding-top: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
