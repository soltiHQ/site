<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseFullBleed from '@/components/layout/BaseFullBleed.vue'
import BaseStack from '@/components/layout/BaseStack.vue'
import BaseActionLink from '@/components/ui/BaseActionLink.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseText from '@/components/ui/BaseText.vue'
import BaseView from '@/components/view/BaseView.vue'

const heroVideo = ref<HTMLVideoElement | null>(null)

let videoObserver: IntersectionObserver | undefined
let heroIsVisible = false

function hydrateVideo(video: HTMLVideoElement) {
  let changed = false
  video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((source) => {
    if (!source.dataset.src) return
    source.src = source.dataset.src
    source.removeAttribute('data-src')
    changed = true
  })
  if (changed) video.load()
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

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const video = heroVideo.value
  if (!video) return

  videoObserver = new IntersectionObserver(
    ([entry]) => {
      heroIsVisible = (entry?.intersectionRatio ?? 0) >= 0.2
      updateHeroVideo()
    },
    { threshold: [0, 0.2] },
  )

  videoObserver.observe(video)
  document.addEventListener('visibilitychange', updateHeroVideo)
})

onBeforeUnmount(() => {
  videoObserver?.disconnect()
  document.removeEventListener('visibilitychange', updateHeroVideo)
})
</script>

<template>
  <BaseView class="content-view">
    <section class="content-view__hero" aria-labelledby="hero-title">
      <div class="content-view__hero-visual" aria-hidden="true">
        <video
          ref="heroVideo"
          class="content-view__hero-video"
          muted
          loop
          playsinline
          preload="metadata"
          poster="/media/hero-conductor-static-shadow-000.avif?v=20260816m"
          tabindex="-1"
        >
          <source
            data-src="/media/hero-conductor-static-shadow-000.webm?v=20260816m"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference)"
          />
          <source
            data-src="/media/hero-conductor-static-shadow-000.mp4?v=20260816m"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference)"
          />
        </video>
      </div>
      <div
        class="content-view__visual-labels content-view__visual-labels--rest"
        aria-hidden="true"
      >
        <span class="content-view__visual-label content-view__visual-label--podium">
          <span class="content-view__visual-label-name">Podium</span>
        </span>
        <span class="content-view__visual-label content-view__visual-label--sdk">
          <span class="content-view__visual-label-name">SDK</span>
        </span>
        <span class="content-view__visual-label content-view__visual-label--taskvisor">
          <span class="content-view__visual-label-name">Taskvisor</span>
        </span>
      </div>

      <BaseContainer class="content-view__hero-content">
        <div class="content-view__hero-copy">
          <BaseHeading
            id="hero-title"
            as="h1"
            size="display"
            class="content-view__hero-title"
          >
            Compose systems.
          </BaseHeading>
          <BaseText class="content-view__hero-lede" tone="muted">
            Taskvisor, Solti SDK, and Podium—alone or in concert.
          </BaseText>
          <BaseActionLink href="https://github.com/soltiHQ" external variant="primary">
            Explore Solti ↗
          </BaseActionLink>
        </div>
      </BaseContainer>
    </section>

    <BaseContainer>
      <BaseFullBleed
        as="section"
        class="content-view__full-bleed-preview"
        aria-labelledby="full-bleed-preview-title"
      >
        <BaseStack :space="4" class="content-view__full-bleed-preview-copy">
          <BaseLabel>BaseFullBleed / viewport width</BaseLabel>
          <BaseHeading id="full-bleed-preview-title" as="h2" size="h1">
            Edge-to-edge content.
          </BaseHeading>
        </BaseStack>
      </BaseFullBleed>
    </BaseContainer>

    <section class="o-section content-view__copy" aria-labelledby="scroll-preview-title">
      <BaseContainer class="content-view__columns">
        <BaseLabel>Scroll / behavior preview</BaseLabel>
        <BaseStack :space="5">
          <BaseHeading id="scroll-preview-title" as="h2" size="h1">
            Content moves behind the glass.
          </BaseHeading>
          <BaseText tone="muted">
            The header remains fixed to the viewport. Text passing underneath it provides a clear
            reference for the current opacity and backdrop blur.
          </BaseText>
          <BaseText tone="muted">
            These paragraphs are placeholders, not final product messaging. They can be replaced
            by composed sections without changing the shared View, layout, or style layers.
          </BaseText>
        </BaseStack>
      </BaseContainer>
    </section>
  </BaseView>
</template>
