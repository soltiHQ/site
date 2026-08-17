<script setup lang="ts">
import SiteFooter from '@/components/chrome/SiteFooter.vue'
import SiteHeader from '@/components/chrome/SiteHeader.vue'
import { siteContent } from '@/contents'
</script>

<template>
  <a class="skip-link" :href="siteContent.links.mainContent">
    {{ siteContent.accessibility.skipToContent }}
  </a>
  <SiteHeader />
  <RouterView />
  <SiteFooter />
</template>
