import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import { uploadLiteratureFile } from '@/api/modules/literature'
import { validateIngestChunkParams } from '@/utils/chunkUploadParams'

export type UseLiteratureUploadOptions = {
  collectionId: Ref<string | null>
  loadFiles: () => Promise<void>
}

/**
 * 文献分片上传：校验 chunk 参数、多文件依次上传、回写临时库 ID 与结果文案。
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

  async function onFileChange(e: Event) {
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
    const total = list.length
    let currentColl = collectionId.value
    const errors: string[] = []
    let ok = 0
    try {
      for (let i = 0; i < total; i++) {
        const f = list[i]!
        if (total > 1) {
          msg.value = `上传中 ${i + 1}/${total}：${f.name}…`
        }
        try {
          const fd = new FormData()
          fd.append('file', f)
          if (currentColl) {
            fd.append('collectionId', currentColl)
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
            currentColl = row.tempCollectionId
            collectionId.value = currentColl
          }
          ok++
        } catch (err) {
          errors.push(`${f.name}：${getErrorMessage(err)}`)
        }
      }
      await loadFiles()
      if (errors.length === 0) {
        msg.value =
          total === 1 && list[0]
            ? `已解析入库：${list[0].name}`
            : `已依次入库 ${ok} 个文件`
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
    /** 绑定至 `<input type="file" @change="…" />` */
    handleUpload: onFileChange,
  }
}
