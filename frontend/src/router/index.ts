import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layout/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      redirect: '/consultation',
      children: [
        {
          path: 'consultation',
          name: 'consultation',
          component: () => import('@/views/consultation/Index.vue'),
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/knowledge/Index.vue'),
        },
        {
          path: 'literature',
          name: 'literature',
          component: () => import('@/views/literature/Index.vue'),
        },
        {
          path: 'agent',
          name: 'agent',
          component: () => import('@/views/agent/Index.vue'),
        },
      ],
    },
  ],
})

export default router
