<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="ds-not-found">
    <p class="ds-not-found-title">页面不存在</p>
    <p class="ds-not-found-hint">链接可能有误，或页面已被移动。</p>
    <RouterLink to="/consultation" class="ds-not-found-link">返回问诊</RouterLink>
  </div>
</template>

<style scoped>
.ds-not-found {
  padding: 2rem;
  max-width: 28rem;
}
.ds-not-found-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.ds-not-found-hint {
  margin: 0 0 1rem;
  color: var(--color-text-secondary, #666);
}
.ds-not-found-link {
  color: var(--color-primary, #0d6efd);
}
</style>
