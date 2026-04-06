<script setup lang="ts">
import { useLiteratureUpload } from '@/views/literature/composables/useLiteratureUpload'

const collectionId = defineModel<string | null>('collectionId', { required: true })

const props = defineProps<{
  loadFiles: () => Promise<void>
}>()

const { chunkSize, chunkOverlap, uploading, msg, handleUpload } = useLiteratureUpload({
  collectionId,
  loadFiles: () => props.loadFiles(),
})

defineExpose({
  isUploading: (): boolean => uploading.value,
  setUploadMessage: (text: string) => {
    msg.value = text
  },
})
</script>

<template>
  <div class="ingest-upload-manager">
    <h3 class="ds-h3 ds-card__title ingest-upload-manager__title">
      上传文献
    </h3>
    <p class="ds-hint ingest-upload-manager__hint lit-upload-hint">
      可多选文件并行解析（同一批最多 3 个在传）；同一批上传会共享当前临时库 ID（首批会自动建库）。重叠为 0 时按 Token 分块；重叠
      &gt;0 时按码点滑动窗口（参数含义与知识库页一致）。
    </p>
    <div class="ingest-upload-manager__sliders">
      <div class="ingest-slider-field">
        <span class="ingest-slider-field__label">分块约长（chunkSize）</span>
        <el-slider
          v-model="chunkSize"
          :min="128"
          :max="2048"
          :step="64"
          :disabled="uploading"
          show-input
          input-size="small"
          class="ingest-el-slider"
        />
      </div>
      <div class="ingest-slider-field">
        <span class="ingest-slider-field__label">重叠（chunkOverlap）</span>
        <el-slider
          v-model="chunkOverlap"
          :min="0"
          :max="1024"
          :step="32"
          :disabled="uploading"
          show-input
          input-size="small"
          class="ingest-el-slider"
          title="0=Token 切分；>0=码点滑动窗口"
        />
      </div>
    </div>
    <div class="ds-row ds-row--center ingest-upload-manager__actions">
      <label class="ds-file-label ds-file-label--solid ingest-upload-manager__file-btn">
        选择文件
        <input
          type="file"
          multiple
          :disabled="uploading"
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
