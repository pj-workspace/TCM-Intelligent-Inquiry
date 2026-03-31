import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const sessionId = ref<string | null>(null)

  function setSessionId(id: string | null) {
    sessionId.value = id
  }

  return { sessionId, setSessionId }
})
