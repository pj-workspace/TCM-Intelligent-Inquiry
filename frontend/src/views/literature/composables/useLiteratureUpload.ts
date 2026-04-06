import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import { uploadLiteratureFile } from '@/api/modules/literature'
import { validateIngestChunkParams } from '@/utils/chunkUploadParams'
import { mapLimit } from '@/utils/mapLimit'

const UPLOAD_CONCURRENCY = 3

export type UseLiteratureUploadOptions = {
  collectionId: Ref<string | null>
  loadFiles: () => Promise<void>
}

/**
 * 文献分片上传：校验 chunk 参数、首批无库 ID 时先完成首文件再并发限流、回写临时库 ID。
 */
export function useLiteratureUpload({
  collectionId,
  loadFiles,
}: UseLiteratureUploadOptions) {
  const uploading = ref(false)
  const msg = ref('')
  const chunkSize = ref(512)
  /** 与知识库相同：>0 时滑动窗口（码点），chunkSize 为窗口长度 */
  const chunkOverlap = ref(0)

  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement
    const list = input.files
    input.value = ''
    if (!list?.length) return
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
      const cid = collectionId.value
      if (cid) {
        fd.append('collectionId', cid)
      }
      if (chunkSize.value > 32) {
        fd.append('chunkSize', String(chunkSize.value))
      }
      if (chunkOverlap.value > 0) {
        fd.append('chunkOverlap', String(chunkOverlap.value))
      }
      const { data } = await uploadLiteratureFile(fd, silentAxiosConfig)
      if (data.code !== 0) throw new Error(data.message)
      const row = data.data
      if (row?.tempCollectionId) {
        collectionId.value = row.tempCollectionId
      }
    }

    const processFile = async (f: File) => {
      try {
        await uploadOne(f)
        ok++
        lines.push(`✓ ${f.name}`)
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
      let rest = files
      if (collectionId.value == null && files.length > 0) {
        await processFile(files[0]!)
        rest = files.slice(1)
      }
      if (rest.length > 0) {
        await mapLimit(rest, UPLOAD_CONCURRENCY, (f) => processFile(f))
      }
      await loadFiles()
      if (errors.length === 0) {
        msg.value =
          total === 1 && files[0]
            ? `已解析入库：${files[0].name}`
            : `已完成入库 ${ok} 个文件`
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
