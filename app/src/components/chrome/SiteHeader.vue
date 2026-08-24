<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import SoltiWordmark from '@/components/brand/SoltiWordmark.vue'
import { usePageChrome } from '@/composables/usePageChrome'
import { siteContent } from '@/contents'

const { activeTheme, isScrolled } = usePageChrome()
const header = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
const isMenuOpen = ref(false)
const menuId = 'site-header-menu'

function closeMenu(restoreFocus = false) {
  if (!isMenuOpen.value) return

  isMenuOpen.value = false

  if (restoreFocus) {
    menuButton.value?.focus()
  }
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isMenuOpen.value || !(event.target instanceof Node)) return
  if (!header.value?.contains(event.target)) closeMenu()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu(true)
}

function handleResize() {
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleResize, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <header
    ref="header"
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

          <button
            v-if="$slots.navigation"
            ref="menuButton"
            :class="[
              'site-header__menu-toggle',
              { 'site-header__menu-toggle--open': isMenuOpen },
            ]"
            type="button"
            :aria-label="
              isMenuOpen
                ? siteContent.accessibility.closeNavigation
                : siteContent.accessibility.openNavigation
            "
            :aria-controls="menuId"
            :aria-expanded="isMenuOpen"
            @click="toggleMenu"
          >
            <span class="site-header__menu-icon" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          <nav
            v-if="$slots.navigation && isMenuOpen"
            :id="menuId"
            class="site-header__mobile-nav"
            :aria-label="siteContent.accessibility.primaryNavigation"
            @click="closeMenu()"
          >
            <slot name="navigation" />
          </nav>
        </div>
      </div>
    </div>
  </header>
</template>
