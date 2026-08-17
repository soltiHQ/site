<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseActionLink from '@/components/ui/BaseActionLink.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import BaseView from '@/components/view/BaseView.vue'
import soltiLogoDarkUrl from '@/assets/logo/solti-logo-dark.svg'
import { siteContent } from '@/contents'

const heroVideo = ref<HTMLVideoElement | null>(null)
const heroConductor = ref<HTMLImageElement | null>(null)
const isHeroLoading = ref(true)
const pageContent = siteContent.pages.content
const heroMedia = siteContent.media.hero
const HERO_LOADING_TIMEOUT_MS = 8_000

function heroMediaUrl(path: string) {
  return `${path}?v=${heroMedia.version}`
}

const heroPosterUrl = heroMediaUrl(heroMedia.poster)

let videoObserver: IntersectionObserver | undefined
let heroIsVisible = false
let loadedVideoTier: 'mobile' | 'standard' | 'large' | undefined
let videoHydrationStarted = false
let reducedMotion = false
let posterSettled = false
let conductorSettled = false
let videoSettled = false
let heroLoadingTimeout: number | undefined
let sourceErrorCheckTimeout: number | undefined
let posterLoader: HTMLImageElement | undefined
let componentUnmounted = false
let appRoot: HTMLElement | null = null
let appRootWasInert = false
let pageInteractionLocked = false

function lockPageInteraction() {
  appRoot = document.getElementById('app')
  appRootWasInert = appRoot?.hasAttribute('inert') ?? false
  appRoot?.setAttribute('inert', '')
  document.documentElement.classList.add('has-active-preloader')
  pageInteractionLocked = true
}

function restorePageInteraction() {
  if (!pageInteractionLocked) return
  if (!appRootWasInert) appRoot?.removeAttribute('inert')
  document.documentElement.classList.remove('has-active-preloader')
  pageInteractionLocked = false
  appRoot = null
}

function clearHeroLoadingResources() {
  if (heroLoadingTimeout !== undefined) {
    window.clearTimeout(heroLoadingTimeout)
    heroLoadingTimeout = undefined
  }

  if (sourceErrorCheckTimeout !== undefined) {
    window.clearTimeout(sourceErrorCheckTimeout)
    sourceErrorCheckTimeout = undefined
  }

  if (posterLoader) {
    posterLoader.onload = null
    posterLoader.onerror = null
    posterLoader = undefined
  }
}

function finishHeroLoading() {
  if (componentUnmounted || !isHeroLoading.value) return
  isHeroLoading.value = false
  clearHeroLoadingResources()
}

function updateHeroLoading() {
  if (posterSettled && conductorSettled && (reducedMotion || videoSettled)) {
    finishHeroLoading()
  }
}

function settleHeroPoster() {
  posterSettled = true
  updateHeroLoading()
}

function settleHeroConductor() {
  conductorSettled = true
  updateHeroLoading()
}

function settleHeroVideo() {
  videoSettled = true
  updateHeroLoading()
}

function handleHeroSourceError() {
  if (!isHeroLoading.value || !videoHydrationStarted) return

  if (sourceErrorCheckTimeout !== undefined) {
    window.clearTimeout(sourceErrorCheckTimeout)
  }

  sourceErrorCheckTimeout = window.setTimeout(() => {
    sourceErrorCheckTimeout = undefined
    if (heroVideo.value?.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      settleHeroVideo()
    }
  })
}

function getHeroVideoTier() {
  if (window.innerWidth >= 1920) return 'large'
  if (window.innerWidth >= 768) return 'standard'
  return 'mobile'
}

function hydrateVideo(video: HTMLVideoElement) {
  videoHydrationStarted = true
  let changed = false
  video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((source) => {
    if (!source.dataset.src) return
    source.src = source.dataset.src
    source.removeAttribute('data-src')
    changed = true
  })

  const videoTier = getHeroVideoTier()
  if (changed || loadedVideoTier !== videoTier) {
    loadedVideoTier = videoTier
    video.load()
  }
}

function updateHeroVideo() {
  const video = heroVideo.value
  if (!video) return

  if (document.hidden || !heroIsVisible) {
    video.pause()
    return
  }

  hydrateVideo(video)
  void video.play().catch(() => undefined)
}

function handleViewportResize() {
  if (loadedVideoTier === getHeroVideoTier()) return
  updateHeroVideo()
}

onMounted(() => {
  lockPageInteraction()
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  heroLoadingTimeout = window.setTimeout(finishHeroLoading, HERO_LOADING_TIMEOUT_MS)

  posterLoader = new Image()
  posterLoader.onload = settleHeroPoster
  posterLoader.onerror = settleHeroPoster
  posterLoader.src = heroPosterUrl
  if (posterLoader.complete) settleHeroPoster()

  if (heroConductor.value?.complete) settleHeroConductor()

  if (reducedMotion) {
    updateHeroLoading()
    return
  }

  const video = heroVideo.value
  if (!video) return

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) settleHeroVideo()

  document.addEventListener('visibilitychange', updateHeroVideo)
  window.addEventListener('resize', handleViewportResize)

  if (!('IntersectionObserver' in window)) {
    heroIsVisible = true
    updateHeroVideo()
    return
  }

  videoObserver = new IntersectionObserver(
    ([entry]) => {
      heroIsVisible = (entry?.intersectionRatio ?? 0) >= 0.2
      updateHeroVideo()
    },
    { threshold: [0, 0.2] },
  )

  videoObserver.observe(video)
})

onBeforeUnmount(() => {
  componentUnmounted = true
  clearHeroLoadingResources()
  restorePageInteraction()
  videoObserver?.disconnect()
  document.removeEventListener('visibilitychange', updateHeroVideo)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="content-view-preloader" @after-leave="restorePageInteraction">
      <div
        v-if="isHeroLoading"
        class="content-view__preloader"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="content-view__preloader-mark">
          <img
            class="content-view__preloader-logo"
            :src="soltiLogoDarkUrl"
            alt=""
            width="460"
            height="460"
            aria-hidden="true"
          />
          <span class="content-view__preloader-track" aria-hidden="true"></span>
        </div>
        <span class="u-visually-hidden">{{ pageContent.hero.loading }}</span>
      </div>
    </Transition>
  </Teleport>

  <BaseView class="content-view" :aria-busy="isHeroLoading ? 'true' : 'false'">
    <section class="content-view__hero" aria-labelledby="hero-title">
      <div class="content-view__hero-visual" aria-hidden="true">
        <video
          ref="heroVideo"
          class="content-view__hero-video"
          muted
          loop
          playsinline
          preload="metadata"
          :poster="heroPosterUrl"
          tabindex="-1"
          @loadeddata="settleHeroVideo"
          @error="settleHeroVideo"
        >
          <source
            :data-src="heroMediaUrl(heroMedia.video.large.mp4)"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference) and (min-width: 1920px)"
            @error="handleHeroSourceError"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.large.webm)"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference) and (min-width: 1920px)"
            @error="handleHeroSourceError"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.standard.mp4)"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference) and (min-width: 768px)"
            @error="handleHeroSourceError"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.standard.webm)"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference) and (min-width: 768px)"
            @error="handleHeroSourceError"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.mobile.mp4)"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference)"
            @error="handleHeroSourceError"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.mobile.webm)"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference)"
            @error="handleHeroSourceError"
          />
        </video>
        <img
          ref="heroConductor"
          class="content-view__hero-conductor"
          :src="heroMediaUrl(heroMedia.conductor)"
          alt=""
          width="1065"
          height="1644"
          decoding="async"
          fetchpriority="high"
          @load="settleHeroConductor"
          @error="settleHeroConductor"
        />
        <div class="content-view__visual-labels content-view__visual-labels--rest">
          <span class="content-view__visual-label content-view__visual-label--podium">
            <span class="content-view__visual-label-name">{{ pageContent.hero.labels.podium }}</span>
          </span>
          <span class="content-view__visual-label content-view__visual-label--sdk">
            <span class="content-view__visual-label-name">{{ pageContent.hero.labels.sdk }}</span>
          </span>
          <span class="content-view__visual-label content-view__visual-label--taskvisor">
            <span class="content-view__visual-label-name">{{ pageContent.hero.labels.taskvisor }}</span>
          </span>
        </div>
      </div>

      <BaseContainer class="content-view__hero-content">
        <div class="content-view__hero-copy">
          <BaseHeading
            id="hero-title"
            as="h1"
            size="display"
            class="content-view__hero-title"
          >
            {{ pageContent.hero.title }}
          </BaseHeading>
          <BaseText class="content-view__hero-lede" tone="muted">
            {{ pageContent.hero.lede }}
          </BaseText>
          <BaseActionLink :href="siteContent.links.github" external variant="primary">
            {{ siteContent.actions.explore }}
          </BaseActionLink>
        </div>
      </BaseContainer>
    </section>
  </BaseView>
</template>
