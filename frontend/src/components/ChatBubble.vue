<script setup lang="ts">
import { computed } from 'vue'
import { splitThinkFromAssistant } from '@/utils/splitThink'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()

const parsed = computed(() =>
  props.role === 'assistant' ? splitThinkFromAssistant(props.content) : null
)
</script>

<template>
  <div
    class="ds-bubble"
    :class="role === 'user' ? 'ds-bubble--user' : 'ds-bubble--assistant'"
  >
    <span class="ds-bubble__meta">{{ role === 'user' ? '我' : '助手' }}</span>

    <template v-if="role === 'user'">
      <p class="ds-bubble__text">
        {{ content }}
      </p>
    </template>

    <template v-else-if="parsed">
      <details
        v-if="parsed.think"
        class="ds-think"
        :open="parsed.thinkIncomplete"
      >
        <summary class="ds-think__summary">
          <svg
            class="ds-think__chevron"
            viewBox="0 0 10 10"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="currentColor"
              d="M2.2 1.4 L7.8 5 L2.2 8.6 Z"
            />
          </svg>
          <span class="ds-think__label">{{
            parsed.thinkIncomplete ? '推理中…' : '推理过程'
          }}</span>
        </summary>
        <pre class="ds-think__body">{{ parsed.think }}</pre>
      </details>
      <MarkdownContent
        v-if="parsed.rest.trim()"
        class="ds-bubble__md"
        :source="parsed.rest"
      />
      <p
        v-else-if="!parsed.think && !parsed.thinkIncomplete && !parsed.rest.trim()"
        class="ds-bubble__text ds-muted"
      >
        （无内容）
      </p>
    </template>
  </div>
</template>
