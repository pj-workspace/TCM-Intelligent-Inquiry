import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/styles/design-tokens.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue]', info, err)
}
app.use(createPinia())
app.use(router)
app.mount('#app')
