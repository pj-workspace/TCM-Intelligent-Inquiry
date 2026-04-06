import { ref, unref, type MaybeRef } from 'vue'
import { ElMessage } from 'element-plus'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import { uploadKnowledgeDocument } from '@/api/modules/knowledge'
import { validateIngestChunkParams } from '@/utils/chunkUploadParams'
import { mapLimit } from '@/utils/mapLimit'

const UPLOAD_CONCURRENCY = 3

export type UseKnowledgeUploadOptions = {
  knowledgeBaseId: MaybeRef<number | null>
  loadFiles: () => Promise<void>
}

/**
 * 知识库文档分片上传：参数校验、最多 3 路并发、汇总结果（单文件失败不阻断其余任务）。
 */
export function useKnowledgeUpload({
  knowledgeBaseId,
  loadFiles,
}: UseKnowledgeUploadOptions) {
  const uploading = ref(false)
  const msg = ref('')
  const chunkSize = ref(512)
  /** 码点重叠；>0 时后端走滑动窗口，此时 chunkSize 表示码点窗口长度（建议 ≥128） */
  const chunkOverlap = ref(0)

  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement
    const list = input.files
    input.value = ''
    if (!list?.length) return
    const kbId = unref(knowledgeBaseId)
    if (kbId == null) return
    const paramErr = validateIngestChunkParams(chunkSize.value, chunkOverlap.value)
    if (paramErr) {
      ElMessage.error(paramErr)
      return
    }
    uploading.value = true
    msg.value = ''
    const files = Array.from(list)
    const total = files.length
    const errors: string[] = []
    let ok = 0
    const lines: string[] = []
    let done = 0

    const refreshProgress = () => {
      msg.value = `上传中（最多 ${UPLOAD_CONCURRENCY} 路并发）${done}/${total}\n${lines.join('\n')}`
    }

    const uploadOne = async (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      if (chunkSize.value > 32) {
        fd.append('chunkSize', String(chunkSize.value))
      }
      if (chunkOverlap.value > 0) {
        fd.append('chunkOverlap', String(chunkOverlap.value))
      }
      const { data } = await uploadKnowledgeDocument(kbId, fd, silentAxiosConfig)
      if (data.code !== 0) throw new Error(data.message)
    }

    const processFile = async (f: File) => {
      try {
        await uploadOne(f)
        ok++
        lines.push(`✓ ${f.name}（已写入，向量化排队中）`)
      } catch (err) {
        const m = getErrorMessage(err)
        errors.push(`${f.name}：${m}`)
        lines.push(`✗ ${f.name}：${m}`)
      } finally {
        done++
        refreshProgress()
      }
    }

    try {
      await mapLimit(files, UPLOAD_CONCURRENCY, (f) => processFile(f))
      await loadFiles()
      if (errors.length === 0) {
        msg.value =
          total === 1 && files[0]
            ? `已接收「${files[0].name}」，后台向量化中；可在下方列表查看状态`
            : `已接收 ${ok} 个文件，后台向量化中；可在下方列表查看状态`
      } else {
        msg.value =
          ok > 0
            ? `部分失败（成功 ${ok}/${total}）\n${errors.join('\n')}`
            : errors.join('\n')
      }
    } finally {
      uploading.value = false
    }
  }

  return {
    chunkSize,
    chunkOverlap,
    uploading,
    msg,
    handleUpload,
  }
}
