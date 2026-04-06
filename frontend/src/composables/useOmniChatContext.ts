import { ref, watch } from 'vue'

const STORAGE_KEY = 'tcm-omni-chat-prefs'

type Persisted = {
  knowledgeBaseId: number | null
  /** 空字符串表示未选 */
  literatureCollectionId: string
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Partial<Persisted>
    return {
      knowledgeBaseId:
        typeof o.knowledgeBaseId === 'number' ? o.knowledgeBaseId : null,
      literatureCollectionId:
        typeof o.literatureCollectionId === 'string'
          ? o.literatureCollectionId
          : '',
    }
  } catch {
    return null
  }
}

function savePersisted(p: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/**
 * 问诊侧偏好：可选默认知识库 / 文献库 ID、待发送附图（由 Agent 自行决定是否走识图工具）。
 */
export function useOmniChatContext() {
  const saved = loadPersisted()

  const knowledgeBaseId = ref<number | null>(saved?.knowledgeBaseId ?? null)
  const literatureCollectionId = ref<string>(
    saved?.literatureCollectionId ?? ''
  )
  const pendingImages = ref<File[]>([])

  function persistNow() {
    savePersisted({
      knowledgeBaseId: knowledgeBaseId.value,
      literatureCollectionId:
        literatureCollectionId.value.trim() === ''
          ? ''
          : literatureCollectionId.value.trim(),
    })
  }

  watch([knowledgeBaseId, literatureCollectionId], persistNow, { deep: true })

  function addImagesFromInput(fileList: FileList | null) {
    if (!fileList?.length) return
    const next: File[] = [...pendingImages.value]
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList.item(i)
      if (f && f.type.startsWith('image/')) next.push(f)
    }
    pendingImages.value = next
  }

  function removeImageAt(index: number) {
    pendingImages.value = pendingImages.value.filter((_, i) => i !== index)
  }

  function clearPendingImages() {
    pendingImages.value = []
  }

  return {
    knowledgeBaseId,
    literatureCollectionId,
    pendingImages,
    addImagesFromInput,
    removeImageAt,
    clearPendingImages,
  }
}
