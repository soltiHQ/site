<script setup lang="ts">
import SiteFooter from '@/components/chrome/SiteFooter.vue'
import SiteHeader from '@/components/chrome/SiteHeader.vue'
import { providePageChrome } from '@/composables/usePageChrome'
import { siteContent } from '@/contents'

providePageChrome()
</script>

<template>
  <a class="skip-link" :href="siteContent.links.mainContent">
    {{ siteContent.accessibility.skipToContent }}
  </a>
  <span data-chrome-top-sentinel aria-hidden="true"></span>
  <SiteHeader>
    <template #navigation>
      <a :href="siteContent.links.docs">{{ siteContent.actions.docs }}</a>
    </template>
  </SiteHeader>
  <RouterView />
  <SiteFooter />
</template>
