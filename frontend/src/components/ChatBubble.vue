<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()
</script>

<template>
  <div class="bubble" :class="role">
    <span class="meta">{{ role === 'user' ? '我' : '助手' }}</span>
    <p class="text">{{ content }}</p>
  </div>
</template>

<style scoped>
.bubble {
  max-width: 85%;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  margin-bottom: 0.5rem;
}
.bubble.user {
  margin-left: auto;
  background: #d1fae5;
  color: #065f46;
}
.bubble.assistant {
  margin-right: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.meta {
  display: block;
  font-size: 0.75rem;
  opacity: 0.75;
  margin-bottom: 0.25rem;
}
.text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.45;
}
</style>
