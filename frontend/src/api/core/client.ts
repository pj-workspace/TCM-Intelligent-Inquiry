import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

import type { ApiResult } from '@/types/api'

import {
  ApiBusinessError,
  MSG_NETWORK,
  MSG_SERVER,
  MSG_TIMEOUT,
  isApiResultBody,
} from './errors'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** 传给 axios：跳过全局 ElMessage，由页面自行展示（问诊 DsAlert、知识库 ingestMsg 等） */
export const silentAxiosConfig: AxiosRequestConfig = { skipGlobalMessage: true }

/**
 * 企业级全局错误提示：默认对 API 失败弹出 Message；内联已处理场景请传 {@link silentAxiosConfig}。
 */
function notifyGlobalApiError(
  message: string,
  requestConfig?: AxiosRequestConfig | null
) {
  if (requestConfig?.skipGlobalMessage) return
  ElMessage.error(message)
}

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data
    if (isApiResultBody(body) && body.code !== 0) {
      const err = new ApiBusinessError(
        body.message || '请求失败',
        body.code,
        response.status
      )
      notifyGlobalApiError(err.message, response.config)
      return Promise.reject(err)
    }
    return response
  },
  (error: AxiosError<ApiResult<unknown>>) => {
    const status = error.response?.status
    const data = error.response?.data
    let err: ApiBusinessError
    if (isApiResultBody(data)) {
      err = new ApiBusinessError(
        data.message || '请求失败',
        data.code ?? status ?? -1,
        status
      )
    } else if (error.code === 'ECONNABORTED') {
      err = new ApiBusinessError(MSG_TIMEOUT, -1, status)
    } else if (!error.response) {
      err = new ApiBusinessError(MSG_NETWORK, -1, undefined)
    } else {
      const st = status ?? 0
      const msg = st >= 500 ? MSG_SERVER : `请求失败（${st}）`
      err = new ApiBusinessError(msg, st, status)
    }
    notifyGlobalApiError(err.message, error.config)
    return Promise.reject(err)
  }
)
