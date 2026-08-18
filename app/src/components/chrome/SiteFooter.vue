<script setup lang="ts">
import SoltiWordmark from '@/components/brand/SoltiWordmark.vue'
import { siteContent } from '@/contents'
</script>

<template>
  <footer class="site-footer" data-chrome-theme="dark">
    <div class="o-container site-footer__inner">
      <SoltiWordmark
        :label="siteContent.brand.name"
        :wordmark="siteContent.brand.wordmark"
        inverse
      />
      <span class="site-footer__descriptor">{{ siteContent.footer.descriptor }}</span>
      <nav class="site-footer__links" :aria-label="siteContent.accessibility.footerNavigation">
        <a :href="siteContent.links.mainContent">{{ siteContent.actions.top }}</a>
        <a :href="siteContent.links.github" target="_blank" rel="noreferrer">
          {{ siteContent.actions.source }}
        </a>
      </nav>
    </div>
  </footer>
</template>
