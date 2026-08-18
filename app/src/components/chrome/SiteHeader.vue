<script setup lang="ts">
import SoltiWordmark from '@/components/brand/SoltiWordmark.vue'
import { usePageChrome } from '@/composables/usePageChrome'
import { siteContent } from '@/contents'

const { activeTheme, isScrolled } = usePageChrome()
</script>

<template>
  <header
    :class="['site-header', { 'site-header--scrolled': isScrolled }]"
    :data-active-chrome-theme="activeTheme"
    data-chrome-probe
  >
    <div class="site-header__glass">
      <div class="site-header__inner">
        <RouterLink
          class="site-header__brand"
          :to="{ name: 'content' }"
          :aria-label="siteContent.accessibility.home"
        >
          <SoltiWordmark
            class="site-header__brand-wordmark"
            :label="siteContent.brand.name"
            :wordmark="siteContent.brand.wordmark"
            :inverse="activeTheme === 'dark'"
            decorative
          />
        </RouterLink>

        <nav
          v-if="$slots.navigation"
          class="site-header__nav"
          :aria-label="siteContent.accessibility.primaryNavigation"
        >
          <slot name="navigation" />
        </nav>
        <div v-else class="site-header__nav" aria-hidden="true"></div>

        <div class="site-header__actions">
          <a :href="siteContent.links.github" target="_blank" rel="noreferrer">
            {{ siteContent.actions.source }}
          </a>
        </div>
      </div>
    </div>
  </header>
</template>
