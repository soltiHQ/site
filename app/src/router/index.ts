import { createRouter, createWebHistory } from 'vue-router'

import { siteContent } from '@/contents'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 100 }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'content',
      component: () => import('@/views/ContentView.vue'),
      meta: { title: siteContent.meta.title },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  document.title = typeof to.meta.title === 'string' ? to.meta.title : siteContent.brand.name
})

export default router
