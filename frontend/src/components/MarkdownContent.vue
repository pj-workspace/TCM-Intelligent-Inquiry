<script setup lang="ts">
import { computed } from 'vue'
import { markdownToSafeHtml } from '@/utils/renderMarkdown'

const props = defineProps<{
  source: string
}>()

const html = computed(() => markdownToSafeHtml(props.source))
</script>

<template>
  <div class="ds-markdown" v-html="html" />
</template>
