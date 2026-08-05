<script setup lang="ts">
import SiteFooter from '@/components/chrome/SiteFooter.vue'
import SiteHeader from '@/components/chrome/SiteHeader.vue'
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <SiteHeader />
  <RouterView />
  <SiteFooter />
</template>
