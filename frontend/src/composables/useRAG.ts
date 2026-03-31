import { ref } from 'vue'

export function useRAG() {
  const query = ref('')
  const results = ref<{ id: string; snippet: string }[]>([])
  const loading = ref(false)

  return {
    query,
    results,
    loading,
  }
}
