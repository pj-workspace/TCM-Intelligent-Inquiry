<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAppStore } from '@/store/appStore'

const app = useAppStore()

const links = [
  { to: '/consultation', label: '智能问诊' },
  { to: '/knowledge', label: '知识库' },
  { to: '/literature', label: '文献' },
  { to: '/agent', label: '智能体' },
] as const
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <h1 class="brand">{{ app.title }}</h1>
      <nav>
        <RouterLink
          v-for="item in links"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          active-class="active"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
  background: #f6f7f9;
}
.sidebar {
  width: 220px;
  padding: 1.25rem 1rem;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
}
.brand {
  margin: 0 0 1.25rem;
  font-size: 1.1rem;
  font-weight: 600;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.nav-link {
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  color: #374151;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.nav-link:hover {
  background: #f3f4f6;
}
.nav-link.active {
  background: #ecfdf5;
  color: #047857;
  font-weight: 500;
}
.main {
  flex: 1;
  padding: 1.5rem 2rem;
  overflow: auto;
}
</style>
