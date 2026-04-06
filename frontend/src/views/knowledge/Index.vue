<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import {
  deleteKnowledgeDocument,
  getKnowledgeHealth,
  listKnowledgeBases,
  listKnowledgeDocuments,
} from '@/api/modules/knowledge'
import KnowledgeBaseSelector from '@/views/knowledge/components/KnowledgeBaseSelector.vue'
import KnowledgeFileTable from '@/views/knowledge/components/KnowledgeFileTable.vue'
import KnowledgeProbeChat from '@/views/knowledge/components/KnowledgeProbeChat.vue'
import { useKnowledgeUpload } from '@/views/knowledge/composables/useKnowledgeUpload'
import type { KnowledgeBase, KnowledgeFileView } from '@/types/knowledge'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'

const health = ref('加载中…')
const kbList = ref<KnowledgeBase[]>([])
const currentKbId = ref<number | null>(null)
const files = ref<KnowledgeFileView[]>([])
const loadingFiles = ref(false)
const bootstrapMsg = ref('')

async function loadKnowledgeBases() {
  const { data } = await listKnowledgeBases(silentAxiosConfig)
  if (data.code !== 0) throw new Error(data.message)
  kbList.value = data.data ?? []
  if (currentKbId.value == null && kbList.value.length > 0) {
    currentKbId.value = kbList.value[0].id
  }
}

async function loadFiles() {
  if (currentKbId.value == null) {
    files.value = []
    return
  }
  loadingFiles.value = true
  try {
    const { data } = await listKnowledgeDocuments(
      currentKbId.value,
      silentAxiosConfig
    )
    if (data.code !== 0) throw new Error(data.message)
    files.value = data.data ?? []
  } finally {
    loadingFiles.value = false
  }
}

const {
  chunkSize,
  chunkOverlap,
  uploading,
  msg: ingestMsg,
  handleUpload,
} = useKnowledgeUpload({
  knowledgeBaseId: currentKbId,
  loadFiles,
})

async function refreshHealth() {
  try {
    const { data } = await getKnowledgeHealth(silentAxiosConfig)
    health.value = formatHealthStatus(data.code, data.message ?? '')
  } catch (e) {
    health.value = getErrorMessage(e)
  }
}

async function reloadBasesSafe() {
  try {
    await loadKnowledgeBases()
  } catch (e) {
    ElMessage.error(getErrorMessage(e))
  }
}

watch(currentKbId, () => {
  void loadFiles()
})

async function removeFile(fileUuid: string) {
  if (currentKbId.value == null) return
  if (!confirm('确定从该知识库删除此文档及其向量？')) return
  await deleteKnowledgeDocument(
    currentKbId.value,
    fileUuid,
    silentAxiosConfig
  )
  await loadFiles()
}

onMounted(async () => {
  await refreshHealth()
  try {
    await loadKnowledgeBases()
  } catch (e) {
    bootstrapMsg.value = getErrorMessage(e)
  }
})
</script>

<template>
  <div
    class="ds-page kb-page"
  >
    <h2 class="ds-h2">
      知识库管理
    </h2>
    <p class="ds-lead kb-lead">
      在此维护向量知识库与文档；下方「检索试答」可对当前库做单次非流式验库。多轮问诊、导出与高级参数仍请使用「智能问诊」中的「知识库 RAG」模式。
    </p>
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
    <p
      v-if="bootstrapMsg"
      class="kb-bootstrap-msg"
      role="alert"
    >
      {{ bootstrapMsg }}
    </p>

    <KnowledgeBaseSelector
      v-model:selected-id="currentKbId"
      :bases="kbList"
      @reload-bases="reloadBasesSafe"
    />

    <KnowledgeProbeChat :knowledge-base-id="currentKbId" />

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        上传与文档列表
      </h3>
      <p class="ds-hint">
        使用 Apache Tika 解析 PDF/Word/TXT 等；可多选文件依次入库。<strong>重叠为 0</strong> 时按 Spring AI
        Token 分块（chunkSize 为 token 上限）；<strong>重叠大于 0</strong> 时按 Unicode 码点滑动窗口（chunkSize
        为窗口长度，须 ≥64，建议 ≥128；chunkOverlap 为相邻切片重叠码点数，须小于窗口）。「向量块数」为实际写入向量库的切片条数。删除会移除向量切片。
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
        <label class="ds-field kb-field-inline">
          重叠（chunkOverlap，码点）
          <input
            v-model.number="chunkOverlap"
            class="ds-input ds-input--narrow"
            type="number"
            inputmode="numeric"
            min="0"
            max="1024"
            step="32"
            title="0 表示不重叠（Token 切分）；大于 0 启用滑动窗口"
          >
        </label>
        <label class="ds-file-label ds-file-label--solid kb-file-btn">
          选择文件上传
          <input
            type="file"
            multiple
            :disabled="uploading || currentKbId == null"
            @change="handleUpload"
          >
        </label>
      </div>
      <p
        v-if="ingestMsg"
        class="ds-msg--success"
      >
        {{ ingestMsg }}
      </p>
      <KnowledgeFileTable
        :files="files"
        :loading="loadingFiles"
        :knowledge-base-selected="currentKbId != null"
        @remove="removeFile"
      />
    </section>
  </div>
</template>

<style scoped>
.kb-page {
  max-width: 56rem;
}
.kb-lead {
  margin-top: -0.25rem;
  margin-bottom: 0.75rem;
  max-width: 40rem;
}
.kb-health {
  margin-bottom: 1.25rem;
}
.kb-bootstrap-msg {
  margin: -0.75rem 0 1rem;
  font-size: 0.875rem;
  color: var(--color-danger);
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
</style>
