<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseActionLink from '@/components/ui/BaseActionLink.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import { siteContent } from '@/contents'

const pageContent = siteContent.pages.content
const heroMedia = siteContent.media.hero
const heroVideo = ref<HTMLVideoElement | null>(null)

function heroMediaUrl(path: string) {
  return `${path}?v=${heroMedia.version}`
}

const heroPosterUrl = heroMediaUrl(heroMedia.poster)

let videoObserver: IntersectionObserver | undefined
let heroIsVisible = false
let loadedVideoTier: 'mobile' | 'standard' | 'large' | undefined

function getHeroVideoTier() {
  if (window.innerWidth >= 1920) return 'large'
  if (window.innerWidth >= 768) return 'standard'
  return 'mobile'
}

function hydrateVideo(video: HTMLVideoElement) {
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion) {
    return
  }

  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  if (connection?.saveData) return

  const video = heroVideo.value
  if (!video) return

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
  videoObserver?.disconnect()
  document.removeEventListener('visibilitychange', updateHeroVideo)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <section
    class="content-view__hero"
    aria-labelledby="hero-title"
    data-chrome-theme="light"
  >
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
      >
        <source
          :data-src="heroMediaUrl(heroMedia.video.large.webm)"
          type='video/webm; codecs="av01.0.12M.08"'
          media="(prefers-reduced-motion: no-preference) and (min-width: 1920px)"
        />
        <source
          :data-src="heroMediaUrl(heroMedia.video.large.mp4)"
          type="video/mp4"
          media="(prefers-reduced-motion: no-preference) and (min-width: 1920px)"
        />
        <source
          :data-src="heroMediaUrl(heroMedia.video.standard.webm)"
          type='video/webm; codecs="av01.0.08M.08"'
          media="(prefers-reduced-motion: no-preference) and (min-width: 768px)"
        />
        <source
          :data-src="heroMediaUrl(heroMedia.video.standard.mp4)"
          type="video/mp4"
          media="(prefers-reduced-motion: no-preference) and (min-width: 768px)"
        />
        <source
          :data-src="heroMediaUrl(heroMedia.video.mobile.webm)"
          type='video/webm; codecs="av01.0.08M.08"'
          media="(prefers-reduced-motion: no-preference)"
        />
        <source
          :data-src="heroMediaUrl(heroMedia.video.mobile.mp4)"
          type="video/mp4"
          media="(prefers-reduced-motion: no-preference)"
        />
      </video>
      <img
        class="content-view__hero-conductor"
        :src="heroMediaUrl(heroMedia.conductor)"
        alt=""
        width="1065"
        height="1644"
        decoding="async"
        fetchpriority="high"
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
          <span>{{ pageContent.hero.lede }}</span>
          <span>{{ pageContent.hero.ledeEmphasis }}</span>
        </BaseText>
        <BaseActionLink
          :href="siteContent.links.github"
          variant="primary"
          external
        >
          {{ siteContent.actions.explore }}
        </BaseActionLink>
      </div>
    </BaseContainer>
  </section>
</template>
