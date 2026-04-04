import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080'

  return {
    plugins: [vue()],
    build: {
      rollupOptions: {
        output: {
          /**
           * 将超大依赖拆出独立 chunk，减轻主包体积与首屏解析压力（仍保留 Vue 核心在主入口链上）。
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('element-plus')) return 'element-plus'
            if (id.includes('markdown-it')) return 'markdown-it'
            if (id.includes('html2canvas') || id.includes('jspdf')) return 'export-pdf'
            return undefined
          },
        },
      },
      // element-plus 单包仍较大，拆出后约 1MB；主入口已显著减小
      chunkSizeWarningLimit: 1100,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.ts'],
    },
  }
})
