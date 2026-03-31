<script setup lang="ts">
import { ref } from 'vue'

const model = defineModel<string>({ default: 'default' })

const options = ['default', 'fast', 'reasoning'] as const
const open = ref(false)

function pick(m: (typeof options)[number]) {
  model.value = m
  open.value = false
}
</script>

<template>
  <div class="switch">
    <button type="button" class="trigger" @click="open = !open">
      模型：{{ model }}
    </button>
    <ul v-if="open" class="menu">
      <li v-for="opt in options" :key="opt">
        <button type="button" class="item" @click="pick(opt)">{{ opt }}</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.switch {
  position: relative;
  display: inline-block;
}
.trigger {
  padding: 0.35rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
}
.menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin: 0.25rem 0 0;
  padding: 0.25rem 0;
  list-style: none;
  min-width: 140px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
}
.item {
  display: block;
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 0.875rem;
}
.item:hover {
  background: #f3f4f6;
}
</style>
