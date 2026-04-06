import { onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import { getErrorMessage } from '@/api/core/errors'
import type { ChatTurn } from '@/composables/useChat'
import {
  downloadConsultationMarkdownFile,
  downloadConsultationPdfFile,
} from '@/utils/consultExport'

export type UseChatExportInput = {
  sessionTitle: ComputedRef<string>
  messages: Ref<ChatTurn[]>
  loading: Ref<boolean>
  streamingContent: Ref<string>
}

/**
 * 问诊会话导出 Markdown / PDF，含按钮态与简短提示。
 */
export function useChatExport(input: UseChatExportInput) {
  const exportBusy = ref(false)
  const exportHint = ref<string | null>(null)
  let exportHintTimer: ReturnType<typeof setTimeout> | null = null

  function flashExportHint(text: string) {
    exportHint.value = text
    if (exportHintTimer) clearTimeout(exportHintTimer)
    exportHintTimer = setTimeout(() => {
      exportHint.value = null
      exportHintTimer = null
    }, 4500)
  }

  function streamSnap(): string | null {
    return input.loading.value && input.streamingContent.value
      ? input.streamingContent.value
      : null
  }

  function exportMd() {
    const title = input.sessionTitle.value
    const snap = streamSnap()
    if (
      input.messages.value.length === 0 &&
      (snap == null || snap.trim() === '')
    ) {
      flashExportHint('当前没有可导出的对话内容')
      return
    }
    try {
      downloadConsultationMarkdownFile(title, input.messages.value, snap)
      flashExportHint('已下载 Markdown 文件')
    } catch (e) {
      flashExportHint(`导出失败：${getErrorMessage(e)}`)
    }
  }

  async function exportPdf() {
    const title = input.sessionTitle.value
    const snap = streamSnap()
    if (
      input.messages.value.length === 0 &&
      (snap == null || snap.trim() === '')
    ) {
      flashExportHint('当前没有可导出的对话内容')
      return
    }
    exportBusy.value = true
    exportHint.value = null
    try {
      await downloadConsultationPdfFile(title, input.messages.value, snap)
      flashExportHint('已生成并下载 PDF')
    } catch (e) {
      flashExportHint(`PDF 导出失败：${getErrorMessage(e)}`)
    } finally {
      exportBusy.value = false
    }
  }

  onUnmounted(() => {
    if (exportHintTimer) clearTimeout(exportHintTimer)
  })

  return { exportMd, exportPdf, exportHint, exportBusy }
}
