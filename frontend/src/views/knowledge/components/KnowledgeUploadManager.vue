<script setup lang="ts">
import { toRef } from 'vue'
import { useKnowledgeUpload } from '@/views/knowledge/composables/useKnowledgeUpload'

const props = defineProps<{
  knowledgeBaseId: number | null
  loadFiles: () => Promise<void>
}>()

const { chunkSize, chunkOverlap, uploading, msg, handleUpload } = useKnowledgeUpload({
  knowledgeBaseId: toRef(props, 'knowledgeBaseId'),
  loadFiles: () => props.loadFiles(),
})
</script>

<template>
  <div class="ingest-upload-manager">
    <h3 class="ds-h3 ds-card__title ingest-upload-manager__title">
      上传与文档列表
    </h3>
    <p class="ds-hint ingest-upload-manager__hint">
      使用 Apache Tika 解析 PDF/Word/TXT 等；可多选文件并行入库（同一批最多 3 个在传）。<strong>重叠为 0</strong> 时按 Spring AI
      Token 分块（chunkSize 为 token 上限）；<strong>重叠大于 0</strong> 时按 Unicode 码点滑动窗口（chunkSize
      为窗口长度，须 ≥64，建议 ≥128；chunkOverlap 为相邻切片重叠码点数，须小于窗口）。「向量块数」为实际写入向量库的切片条数。删除会移除向量切片。
    </p>
    <div class="ingest-upload-manager__sliders">
      <div class="ingest-slider-field">
        <span class="ingest-slider-field__label">分块约长（chunkSize）</span>
        <el-slider
          v-model="chunkSize"
          :min="128"
          :max="2048"
          :step="64"
          :disabled="uploading || knowledgeBaseId == null"
          :show-tooltip="true"
          show-input
          input-size="small"
          class="ingest-el-slider"
        />
      </div>
      <div class="ingest-slider-field">
        <span class="ingest-slider-field__label">重叠（chunkOverlap，码点）</span>
        <el-slider
          v-model="chunkOverlap"
          :min="0"
          :max="1024"
          :step="32"
          :disabled="uploading || knowledgeBaseId == null"
          show-input
          input-size="small"
          class="ingest-el-slider"
          title="0 表示不重叠（Token 切分）；大于 0 启用滑动窗口"
        />
      </div>
    </div>
    <div class="ds-row ds-row--center ingest-upload-manager__actions">
      <label class="ds-file-label ds-file-label--solid ingest-upload-manager__file-btn">
        选择文件上传
        <input
          type="file"
          multiple
          :disabled="uploading || knowledgeBaseId == null"
          @change="handleUpload"
        >
      </label>
    </div>
    <p
      v-if="msg"
      class="ds-msg--success ingest-upload-manager__msg"
    >
      {{ msg }}
    </p>
  </div>
</template>

<style scoped>
.ingest-upload-manager__title {
  margin-top: 0;
}
.ingest-upload-manager__hint {
  margin-top: -0.15rem;
  margin-bottom: 0.65rem;
}
.ingest-upload-manager__sliders {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-width: min(100%, 26rem);
  margin-bottom: 0.35rem;
}
.ingest-slider-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ingest-slider-field__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.ingest-el-slider {
  width: 100%;
}
.ingest-upload-manager__actions {
  margin-top: 0.35rem;
  gap: 1rem;
}
.ingest-upload-manager__file-btn {
  flex-shrink: 0;
}
.ingest-upload-manager__msg {
  margin-top: 0.65rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
