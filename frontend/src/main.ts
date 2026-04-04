import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { ElMessage } from 'element-plus'

import '@/styles/design-tokens.css'
import App from './App.vue'
import router from './router'
import { useThemeStore } from '@/store/themeStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
/**
 * 必须在 app.use(pinia) 之后初始化主题：从 localStorage / 系统偏好恢复 isDark，
 * 并同步 html.dark class，供 Element Plus 变量与 design-tokens 使用。
 */
useThemeStore(pinia).init()

/**
 * Vue 全局错误兜底：开发环境仅控制台输出便于定位；生产环境向用户弹出 Message，
 * 避免白屏无反馈（与 Axios 拦截器的接口错误提示互补，不重复捕获同一类业务错误）。
 */
app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue]', info, err)
  if (import.meta.env.PROD) {
    ElMessage.error('页面出现异常，请刷新后重试')
  }
}

app.use(ElementPlus, { locale: zhCn, size: 'default' })
app.use(router)
app.mount('#app')
