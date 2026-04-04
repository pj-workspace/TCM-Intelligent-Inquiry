import 'axios'

declare module 'axios' {
  /** 为 true 时不弹出 ElMessage，由页面内联错误（如 DsAlert / ingestMsg）承接 */
  interface AxiosRequestConfig {
    skipGlobalMessage?: boolean
  }
}
