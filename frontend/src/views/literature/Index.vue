<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave } from 'vue-router'
import { silentAxiosConfig } from '@/api/core/client'
import { getErrorMessage } from '@/api/core/errors'
import {
  deleteLiteratureCollection,
  deleteLiteratureDocument,
  getLiteratureHealth,
  listLiteratureCollectionFiles,
} from '@/api/modules/literature'
import LiteratureFileTable from '@/views/literature/components/LiteratureFileTable.vue'
import LiteratureProbeChat from '@/views/literature/components/LiteratureProbeChat.vue'
import { useLiteratureUpload } from '@/views/literature/composables/useLiteratureUpload'
import type { LiteratureFileView } from '@/types/literature'
import {
  formatHealthStatus,
  isHealthStatusErr,
  isHealthStatusOk,
} from '@/utils/formatHealthStatus'
import {
  LITERATURE_TAB_COLLECTION_SESSION_KEY,
  setLiteratureTabCollectionId,
} from '@/utils/literatureBeacon'

const health = ref('加载中…')
const collectionId = ref<string | null>(null)
const files = ref<LiteratureFileView[]>([])
const loadingFiles = ref(false)

async function loadFiles() {
  if (!collectionId.value) {
    files.value = []
    return
  }
  loadingFiles.value = true
  try {
    const { data } = await listLiteratureCollectionFiles(
      collectionId.value,
      silentAxiosConfig
    )
    if (data.code !== 0) throw new Error(data.message)
    files.value = data.data ?? []
  } finally {
    loadingFiles.value = false
  }
}

const {
  chunkSize,
  chunkOverlap,
  uploading,
  msg,
  handleUpload,
} = useLiteratureUpload({
  collectionId,
  loadFiles,
})

async function refreshHealth() {
  try {
    const { data } = await getLiteratureHealth(silentAxiosConfig)
    health.value = formatHealthStatus(data.code, data.message ?? '')
  } catch (e) {
    health.value = getErrorMessage(e)
  }
}

watch(collectionId, () => {
  void loadFiles()
})

/**
 * 与 sessionStorage 同步：非空则记录到本标签页（供 pagehide + sendBeacon 释放）；
 * 从「有值」变为空时清除（显式删库 / 新建空库 / 路由守卫删库后）。
 * 初次进入页面且 ref 为空时，不覆盖 storage，以便保留「保留并离开」后的 ID 供恢复或关页释放。
 */
watch(collectionId, (v, oldV) => {
  if (v) {
    setLiteratureTabCollectionId(v)
  } else if (oldV != null) {
    setLiteratureTabCollectionId(null)
  }
})

async function removeFile(fileUuid: string) {
  if (!collectionId.value) return
  if (!confirm('确定从当前文献库删除此文件及其向量？')) return
  await deleteLiteratureDocument(
    collectionId.value,
    fileUuid,
    silentAxiosConfig
  )
  await loadFiles()
}

async function purgeCollection() {
  if (!collectionId.value) return
  if (!confirm('确定删除当前临时文献库及其向量？')) return
  await deleteLiteratureCollection(collectionId.value, silentAxiosConfig)
  collectionId.value = null
  files.value = []
  msg.value = '已清空临时库'
}

async function newCollection() {
  collectionId.value = null
  files.value = []
  msg.value = '请上传首个文件，将自动新建临时文献库'
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/** 同库各行 expiresAt 对齐，取首条展示即可 */
const collectionExpiresLabel = computed(() => {
  const row = files.value.find((f) => f.expiresAt)
  if (!row?.expiresAt) return ''
  return `当前临时库向量与文件计划在 ${formatDate(row.expiresAt)} 自动清理（任一新上传会将整库有效期顺延）。`
})

onMounted(async () => {
  if (!collectionId.value) {
    try {
      const raw = sessionStorage.getItem(LITERATURE_TAB_COLLECTION_SESSION_KEY)
      const trimmed = raw?.trim()
      if (trimmed) {
        collectionId.value = trimmed
      }
    } catch {
      /* ignore */
    }
  }
  await refreshHealth()
})

/**
 * 离开文献管理路由时：若存在活跃临时库，提示是否立即删除服务端向量与元数据（否则仍依赖 TTL）。
 * 上传进行中禁止跳转，避免半途中断导致状态不一致。
 */
onBeforeRouteLeave(async (_to, _from, next) => {
  if (uploading.value) {
    ElMessage.warning('正在上传文献，请等待完成后再切换页面')
    next(false)
    return
  }
  const cid = collectionId.value
  if (!cid) {
    next()
    return
  }
  try {
    await ElMessageBox.confirm(
      '当前已关联临时文献库，向量仍占用 Redis 与服务端元数据（至 TTL 或定时任务清理）。离开本页前是否立即删除整库？',
      '离开文献管理',
      {
        distinguishCancelAndClose: true,
        confirmButtonText: '删除服务端整库并离开',
        cancelButtonText: '保留临时库并离开',
        type: 'warning',
      }
    )
    try {
      await deleteLiteratureCollection(cid, silentAxiosConfig)
      collectionId.value = null
      files.value = []
    } catch (e) {
      ElMessage.error(getErrorMessage(e))
      next(false)
      return
    }
    next()
  } catch (action: unknown) {
    if (action === 'cancel') {
      next()
      return
    }
    next(false)
  }
})
</script>

<template>
  <div
    class="ds-page lit-page"
  >
    <h2 class="ds-h2">
      文献库管理
    </h2>
    <p class="ds-lead lit-lead">
      上传与解析文献向量（进入 Redis Stack，与知识库 metadata 隔离）；服务端按配置对临时库做 TTL
      滑动续期与定时清理。下方「检索试答」可在本页单次验库。问诊请选择「文献库」模式并指定本页临时库 ID。若当前已建临时库，切换到其它路由时会询问是否立即删除服务端整库（亦可保留至 TTL）；关闭或刷新本标签页时会尽力通过浏览器 Beacon 通知服务端释放（与 TTL 互补）。
    </p>
    <p
      class="ds-status lit-health"
      :class="
        isHealthStatusErr(health)
          ? 'ds-status--err'
          : isHealthStatusOk(health)
            ? 'ds-status--ok'
            : ''
      "
    >
      {{ health }}
    </p>

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        临时文献库
      </h3>
      <p
        v-if="collectionId"
        class="lit-meta lit-meta--technical"
      >
        <span class="lit-meta__label">临时库 ID</span>
        <code class="ds-code lit-meta__code">{{ collectionId }}</code>
        <button
          type="button"
          class="ds-btn ds-btn--ghost"
          @click="newCollection"
        >
          新建空库（仅前端切换）
        </button>
        <button
          type="button"
          class="ds-btn ds-btn--danger"
          @click="purgeCollection"
        >
          删除服务端整库
        </button>
      </p>
      <p
        v-else
        class="ds-muted"
      >
        尚未上传：首次上传会自动分配临时库 ID。
      </p>
      <p
        v-if="collectionExpiresLabel"
        class="ds-hint lit-ttl-hint"
      >
        {{ collectionExpiresLabel }}
      </p>
    </section>

    <LiteratureProbeChat :collection-id="collectionId" />

    <section class="ds-card">
      <h3 class="ds-h3 ds-card__title">
        上传文献
      </h3>
      <p class="ds-hint lit-upload-hint">
        可多选文件依次解析；同一批上传会共享当前临时库 ID（首批会自动建库）。重叠为 0 时按 Token 分块；重叠
        &gt;0 时按码点滑动窗口（参数含义与知识库页一致）。
      </p>
      <div class="ds-row ds-row--center lit-upload-row">
        <label class="ds-field lit-field-inline">
          分块约长（chunkSize）
          <input
            v-model.number="chunkSize"
            class="ds-input ds-input--narrow"
            type="number"
            inputmode="numeric"
            min="128"
            max="2048"
            step="64"
          >
        </label>
        <label class="ds-field lit-field-inline">
          重叠（chunkOverlap）
          <input
            v-model.number="chunkOverlap"
            class="ds-input ds-input--narrow"
            type="number"
            inputmode="numeric"
            min="0"
            max="1024"
            step="32"
            title="0=Token 切分；>0=码点滑动窗口"
          >
        </label>
        <label class="ds-file-label ds-file-label--solid lit-file-btn">
          选择文件
          <input
            type="file"
            multiple
            :disabled="uploading"
            @change="handleUpload"
          >
        </label>
      </div>
      <p
        v-if="msg"
        class="ds-msg--success"
      >
        {{ msg }}
      </p>
      <LiteratureFileTable
        :files="files"
        :loading="loadingFiles"
        :collection-id="collectionId"
        @remove="removeFile"
      />
    </section>
  </div>
</template>

<style scoped>
.lit-page {
  max-width: 56rem;
}
.lit-lead {
  margin-top: -0.25rem;
  margin-bottom: 0.75rem;
  max-width: 42rem;
}
.lit-health {
  margin-bottom: 0.75rem;
}
.lit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  margin: 0;
  color: var(--color-text-secondary);
}
.lit-meta--technical {
  font-size: 0.8125rem;
}
.lit-meta__label {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.lit-meta__code {
  font-size: 0.6875rem;
}
.lit-upload-row {
  margin-top: 0.5rem;
  gap: 1rem;
}
.lit-field-inline {
  flex-direction: row;
  align-items: center;
  gap: 0.65rem;
}
.lit-field-inline .ds-input--narrow {
  width: 6.5rem;
  min-width: 6.5rem;
}
.lit-file-btn {
  flex-shrink: 0;
}
</style>
