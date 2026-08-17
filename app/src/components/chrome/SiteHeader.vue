<script setup lang="ts">
import soltiWordDarkUrl from '@/assets/word/solti-word-dark.svg'
import { useHeaderScrollState } from '@/composables/useHeaderScrollState'
import { siteContent } from '@/contents'

const { isScrolled } = useHeaderScrollState()
</script>

<template>
  <header
    :class="['site-header', { 'site-header--scrolled': isScrolled }]"
  >
    <div class="site-header__glass">
      <div class="site-header__inner">
        <RouterLink
          class="site-header__brand"
          :to="{ name: 'content' }"
          :aria-label="siteContent.accessibility.home"
        >
          <img
            class="site-header__brand-word-logo"
            :src="soltiWordDarkUrl"
            alt=""
            width="202"
            height="108"
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
