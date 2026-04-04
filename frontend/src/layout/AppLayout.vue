<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import { useThemeStore } from '@/store/themeStore'

const app = useAppStore()
const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)
const route = useRoute()
const isConsultationWorkspace = computed(
  () => route.matched.some((r) => Boolean(r.meta.consultation))
)

/** 问诊页锁定视口高度，避免历史列表把整页撑出全局滚动条 */
watch(
  isConsultationWorkspace,
  (v) => {
    document.documentElement.classList.toggle('ds-consult-lock', v)
  },
  { immediate: true }
)

onUnmounted(() => {
  document.documentElement.classList.remove('ds-consult-lock')
})

function skipToMain(e: Event) {
  e.preventDefault()
  document.getElementById('main-content')?.focus({ preventScroll: false })
}

const links = [
  {
    to: '/consultation',
    label: '智能问诊',
    icon: 'consult',
  },
  { to: '/knowledge', label: '知识库', icon: 'book' },
  { to: '/literature', label: '文献', icon: 'doc' },
  { to: '/agent', label: '智能体', icon: 'agent' },
] as const
</script>

<template>
  <div
    class="ds-shell"
    :class="{ 'ds-shell--consultation-fill': isConsultationWorkspace }"
  >
    <a
      href="#main-content"
      class="ds-skip-link"
      @click="skipToMain"
    >跳到主内容</a>
    <header
      class="ds-header"
      role="banner"
    >
      <div class="ds-header__inner">
        <RouterLink
          to="/consultation"
          class="ds-header-brand"
          aria-label="TCM 智能问诊 · 首页"
        >
          <div
            class="ds-brand-mark"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v12.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <div class="ds-header-brand__text">
            <span class="ds-brand ds-brand--header">{{ app.title }}</span>
            <span class="ds-brand-sub">Intelligent inquiry</span>
          </div>
        </RouterLink>
        <nav
          class="ds-header-nav"
          aria-label="功能模块"
        >
          <RouterLink
            v-for="item in links"
            :key="item.to"
            :to="item.to"
            class="ds-header-nav-link"
            active-class="active"
          >
            <span
              class="ds-header-nav-icon"
              aria-hidden="true"
            >
              <svg
                v-if="item.icon === 'consult'"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                width="18"
                height="18"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337 5.972 5.972 0 01-3.86-1.59 5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'book'"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                width="18"
                height="18"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'doc'"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                width="18"
                height="18"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                width="18"
                height="18"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </span>
            {{ item.label }}
          </RouterLink>
          <button
            type="button"
            class="ds-btn ds-btn--subtle ds-btn--icon ds-theme-toggle"
            :aria-pressed="isDark"
            :aria-label="isDark ? '切换为浅色界面' : '切换为深色界面'"
            :title="isDark ? '浅色' : '深色'"
            @click="themeStore.toggle()"
          >
            <svg
              v-if="isDark"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          </button>
        </nav>
      </div>
    </header>
    <main
      id="main-content"
      class="ds-main"
      :class="{ 'ds-main--consultation': isConsultationWorkspace }"
      tabindex="-1"
    >
      <div
        class="ds-main-body"
        :class="{ 'ds-main-body--centered': !isConsultationWorkspace }"
      >
        <RouterView />
      </div>
    </main>
  </div>
</template>
