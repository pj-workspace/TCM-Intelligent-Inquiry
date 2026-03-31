<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  select: [files: FileList | null]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  emit('select', input.files)
  input.value = ''
}

function openPicker() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="upload-box">
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      multiple
      @change="onChange"
    />
    <button type="button" class="btn" @click="openPicker">选择文件</button>
    <span class="hint">支持多文件上传（占位）</span>
  </div>
</template>

<style scoped>
.upload-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #fafafa;
}
.hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}
.btn {
  padding: 0.4rem 0.85rem;
  border: none;
  border-radius: 8px;
  background: #059669;
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn:hover {
  background: #047857;
}
.hint {
  font-size: 0.8rem;
  color: #64748b;
}
</style>
