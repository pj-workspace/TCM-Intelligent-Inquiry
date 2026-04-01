<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-padding-top: var(--ds-sticky-nav-h, 0px);
}
body {
  margin: 0;
  font-family: var(--font-body, 'Noto Sans SC', sans-serif);
  font-size: 16px;
  color: var(--color-text, #0f172a);
  background: var(--color-bg, #faf5ff);
}
#app {
  min-height: 100vh;
  min-height: 100dvh;
}
</style>
