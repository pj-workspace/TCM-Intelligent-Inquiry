<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiClient } from '@/api/client'
import type { ApiResult } from '@/types/api'

const health = ref<string>('加载中…')

onMounted(async () => {
  try {
    const { data } = await apiClient.get<ApiResult<unknown>>('/v1/agent/health')
    health.value = `code=${data.code} ${data.message}`
  } catch (e) {
    health.value =
      e instanceof Error ? `请求失败（后端可能未启动）: ${e.message}` : '请求失败'
  }
})
</script>

<template>
  <div class="page">
    <h2>智能体</h2>
    <p class="health">{{ health }}</p>
    <p class="stub">占位：工具调用与多步推理将在此模块扩展。</p>
  </div>
</template>

<style scoped>
.page h2 {
  margin-top: 0;
}
.health {
  font-size: 0.85rem;
  color: #4b5563;
}
.stub {
  color: #6b7280;
  font-size: 0.9rem;
}
</style>
