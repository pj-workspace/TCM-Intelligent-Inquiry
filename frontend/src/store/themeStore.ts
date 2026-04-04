import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'tcm-theme-dark'

/**
 * 全局深浅色：同步 document.documentElement.classList（dark），供 Element Plus css-vars 与本项目 design-tokens 共用。
 */
export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)

  function applyDom() {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function init() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '1') isDark.value = true
    else if (raw === '0') isDark.value = false
    else
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyDom()
  }

  function toggle() {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? '1' : '0')
    applyDom()
  }

  return { isDark, init, toggle }
})
