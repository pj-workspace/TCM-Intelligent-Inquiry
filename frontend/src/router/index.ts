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
          meta: { title: '问诊' },
          component: () => import('@/views/consultation/Index.vue'),
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          meta: { title: '知识库' },
          component: () => import('@/views/knowledge/Index.vue'),
        },
        {
          path: 'literature',
          name: 'literature',
          meta: { title: '文献' },
          component: () => import('@/views/literature/Index.vue'),
        },
        {
          path: 'agent',
          name: 'agent',
          meta: { title: '智能体' },
          component: () => import('@/views/agent/Index.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { title: '未找到' },
      component: () => import('@/views/NotFound.vue'),
    },
  ],
})

router.afterEach((to) => {
  const piece = to.meta.title as string | undefined
  document.title = piece ? `${piece} · TCM 智能问诊` : 'TCM 智能问诊'
})

export default router
