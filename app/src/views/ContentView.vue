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
type SiteLinkKey = keyof typeof siteContent.links

function siteLink(key: string) {
  if (!(key in siteContent.links)) {
    throw new Error(`Unknown site link: ${key}`)
  }

  return siteContent.links[key as SiteLinkKey]
}

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
          <BaseText
            as="p"
            size="caption"
            tone="subtle"
            class="content-view__hero-eyebrow"
          >
            {{ pageContent.hero.eyebrow }}
          </BaseText>
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
          <BaseActionLink :href="siteContent.links.problem" variant="primary">
            {{ siteContent.actions.explore }}
          </BaseActionLink>
        </div>
      </BaseContainer>
    </section>

    <section
      id="problem"
      class="content-view__problem"
      aria-labelledby="problem-title"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__problem-inner">
        <header class="content-view__problem-intro">
          <div class="content-view__problem-heading">
            <BaseText
              as="p"
              size="caption"
              tone="subtle"
              class="content-view__problem-eyebrow"
            >
              {{ pageContent.problem.eyebrow }}
            </BaseText>
            <BaseHeading
              id="problem-title"
              as="h2"
              size="h1"
              class="content-view__problem-title"
            >
              {{ pageContent.problem.title }}
            </BaseHeading>
          </div>
          <BaseText tone="muted" class="content-view__problem-lede">
            {{ pageContent.problem.lede }}
          </BaseText>
        </header>

        <BaseText
          as="p"
          size="caption"
          tone="subtle"
          class="content-view__problem-axis"
        >
          {{ pageContent.problem.axis }}
        </BaseText>

        <ul class="content-view__problem-list">
          <li
            v-for="item in pageContent.problem.items"
            :key="item.title"
            class="content-view__problem-item"
          >
            <span class="content-view__problem-scope">{{ item.scope }}</span>
            <BaseHeading as="h3" size="h2" class="content-view__problem-item-title">
              {{ item.title }}
            </BaseHeading>
            <BaseText tone="muted" class="content-view__problem-item-body">
              {{ item.body }}
            </BaseText>
          </li>
        </ul>
      </BaseContainer>
    </section>

    <section
      id="idea"
      class="content-view__idea"
      aria-labelledby="idea-title"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__idea-inner">
        <header class="content-view__idea-intro">
          <div class="content-view__idea-heading">
            <BaseText
              as="p"
              size="caption"
              tone="subtle"
              class="content-view__idea-eyebrow"
            >
              {{ pageContent.idea.eyebrow }}
            </BaseText>
            <BaseHeading
              id="idea-title"
              as="h2"
              size="h1"
              class="content-view__idea-title"
            >
              {{ pageContent.idea.title }}
            </BaseHeading>
          </div>
          <BaseText tone="muted" class="content-view__idea-lede">
            {{ pageContent.idea.lede }}
          </BaseText>
        </header>

        <ol class="content-view__idea-steps">
          <li
            v-for="step in pageContent.idea.steps"
            :key="step.index"
            class="content-view__idea-step"
          >
            <span class="content-view__idea-index" aria-hidden="true">{{ step.index }}</span>
            <BaseHeading as="h3" size="h3" class="content-view__idea-step-title">
              {{ step.title }}
            </BaseHeading>
            <BaseText tone="muted" class="content-view__idea-step-body">
              {{ step.body }}
            </BaseText>
          </li>
        </ol>

        <p class="content-view__idea-principle">
          {{ pageContent.idea.principle }}
        </p>
      </BaseContainer>
    </section>

    <section
      id="stack"
      class="content-view__composition"
      aria-labelledby="stack-title"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__composition-inner">
        <header class="content-view__composition-intro">
          <BaseText
            as="p"
            size="caption"
            tone="subtle"
            class="content-view__composition-eyebrow"
          >
            {{ pageContent.components.eyebrow }}
          </BaseText>
          <BaseHeading
            id="stack-title"
            as="h2"
            size="h1"
            class="content-view__composition-title"
          >
            {{ pageContent.components.title }}
          </BaseHeading>
          <BaseText tone="muted" class="content-view__composition-lede">
            {{ pageContent.components.lede }}
          </BaseText>
        </header>

        <ul class="content-view__composition-levels">
          <li
            v-for="level in pageContent.components.levels"
            :key="level.product"
            :class="[
              'content-view__composition-level',
              'content-view__composition-level--' + level.tone,
            ]"
          >
            <div class="content-view__composition-meta">
              <span class="content-view__composition-scope">{{ level.scope }}</span>
            </div>
            <div class="content-view__composition-copy">
              <BaseHeading
                as="h3"
                size="h2"
                class="content-view__composition-product"
              >
                {{ level.product }}
              </BaseHeading>
              <span class="content-view__composition-role">{{ level.title }}</span>
              <BaseText tone="muted" class="content-view__composition-level-body">
                {{ level.body }}
              </BaseText>
              <ul class="content-view__composition-capabilities">
                <li v-for="capability in level.capabilities" :key="capability">
                  {{ capability }}
                </li>
              </ul>
              <a
                class="content-view__composition-link"
                :href="siteLink(level.link)"
                target="_blank"
                rel="noreferrer"
              >
                {{ level.action }}
              </a>
            </div>
          </li>
        </ul>
      </BaseContainer>
    </section>

    <section
      id="use-cases"
      class="content-view__use-cases"
      aria-labelledby="use-cases-title"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__use-cases-inner">
        <header class="content-view__use-cases-intro">
          <div class="content-view__use-cases-heading">
            <BaseText
              as="p"
              size="caption"
              tone="subtle"
              class="content-view__use-cases-eyebrow"
            >
              {{ pageContent.useCases.eyebrow }}
            </BaseText>
            <BaseHeading
              id="use-cases-title"
              as="h2"
              size="h1"
              class="content-view__use-cases-title"
            >
              {{ pageContent.useCases.title }}
            </BaseHeading>
          </div>
          <BaseText tone="muted" class="content-view__use-cases-lede">
            {{ pageContent.useCases.lede }}
          </BaseText>
        </header>

        <ul class="content-view__use-case-list">
          <li
            v-for="item in pageContent.useCases.items"
            :key="item.title"
            :class="[
              'content-view__use-case',
              'content-view__use-case--' + item.tone,
            ]"
          >
            <span class="content-view__use-case-product">{{ item.product }}</span>
            <BaseHeading as="h3" size="h2" class="content-view__use-case-title">
              {{ item.title }}
            </BaseHeading>
            <BaseText tone="muted" class="content-view__use-case-body">
              {{ item.body }}
            </BaseText>
            <a
              class="content-view__use-case-link"
              :href="siteLink(item.link)"
              target="_blank"
              rel="noreferrer"
            >
              {{ item.action }}
            </a>
          </li>
        </ul>
      </BaseContainer>
    </section>

    <section
      id="proof"
      class="content-view__proof"
      aria-labelledby="proof-title"
      data-chrome-theme="dark"
    >
      <BaseContainer class="content-view__proof-inner">
        <header class="content-view__proof-intro">
          <BaseText
            as="p"
            size="caption"
            tone="subtle"
            class="content-view__proof-eyebrow"
          >
            {{ pageContent.proof.eyebrow }}
          </BaseText>
          <BaseHeading
            id="proof-title"
            as="h2"
            size="h1"
            class="content-view__proof-title"
          >
            {{ pageContent.proof.title }}
          </BaseHeading>
          <BaseText tone="muted" class="content-view__proof-lede">
            {{ pageContent.proof.lede }}
          </BaseText>
        </header>

        <div class="content-view__proof-workbench">
          <article
            class="content-view__proof-panel content-view__proof-panel--manifest"
            aria-labelledby="proof-manifest-title"
          >
            <header class="content-view__proof-panel-header">
              <div class="content-view__proof-panel-heading">
                <span class="content-view__proof-panel-index" aria-hidden="true">
                  {{ pageContent.proof.manifest.index }}
                </span>
                <BaseHeading
                  id="proof-manifest-title"
                  as="h3"
                  size="h3"
                  class="content-view__proof-panel-title"
                >
                  {{ pageContent.proof.manifest.label }}
                </BaseHeading>
              </div>
              <span class="content-view__proof-panel-source">
                {{ pageContent.proof.manifest.filename }}
              </span>
            </header>
            <pre
              class="content-view__proof-code"
              tabindex="0"
            ><code><span
              v-for="(line, index) in pageContent.proof.manifest.lines"
              :key="index"
              class="content-view__proof-code-line"
            >{{ line || ' ' }}</span></code></pre>
          </article>

          <div class="content-view__proof-connector" aria-hidden="true">
            <span>{{ pageContent.proof.transition }}</span>
          </div>

          <article
            class="content-view__proof-panel content-view__proof-panel--trace"
            aria-labelledby="proof-trace-title"
          >
            <header class="content-view__proof-panel-header">
              <div class="content-view__proof-panel-heading">
                <span class="content-view__proof-panel-index" aria-hidden="true">
                  {{ pageContent.proof.trace.index }}
                </span>
                <BaseHeading
                  id="proof-trace-title"
                  as="h3"
                  size="h3"
                  class="content-view__proof-panel-title"
                >
                  {{ pageContent.proof.trace.label }}
                </BaseHeading>
              </div>
              <span class="content-view__proof-panel-source">
                {{ pageContent.proof.trace.source }}
              </span>
            </header>
            <pre
              class="content-view__proof-code content-view__proof-code--trace"
              tabindex="0"
            ><code><span class="content-view__proof-trace-command">{{ pageContent.proof.trace.command }}</span><span
              v-for="line in pageContent.proof.trace.lines"
              :key="line.text"
              :class="[
                'content-view__proof-code-line',
                'content-view__proof-code-line--' + line.tone,
              ]"
            >{{ line.text }}</span></code></pre>
          </article>
        </div>

        <div class="content-view__proof-footer">
          <dl class="content-view__proof-facts">
            <div
              v-for="fact in pageContent.proof.facts"
              :key="fact.label"
              class="content-view__proof-fact"
            >
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </div>
          </dl>

          <div class="content-view__proof-actions">
            <BaseText as="p" size="small" tone="subtle" class="content-view__proof-note">
              {{ pageContent.proof.note }}
            </BaseText>
            <div class="content-view__proof-action-list">
              <BaseActionLink
                v-for="(action, index) in pageContent.proof.actions"
                :key="action.link"
                :href="siteLink(action.link)"
                :variant="index === 0 ? 'primary' : 'secondary'"
                external
              >
                {{ action.label }}
              </BaseActionLink>
            </div>
          </div>
        </div>
      </BaseContainer>
    </section>

    <section
      id="fit"
      class="content-view__fit"
      aria-labelledby="fit-title"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__fit-inner">
        <header class="content-view__fit-intro">
          <BaseText
            as="p"
            size="caption"
            tone="subtle"
            class="content-view__fit-eyebrow"
          >
            {{ pageContent.fit.eyebrow }}
          </BaseText>
          <BaseHeading
            id="fit-title"
            as="h2"
            size="h1"
            class="content-view__fit-title"
          >
            {{ pageContent.fit.title }}
          </BaseHeading>
          <BaseText tone="muted" class="content-view__fit-lede">
            {{ pageContent.fit.lede }}
          </BaseText>
        </header>

        <dl class="content-view__fit-choices">
          <div
            v-for="(choice, index) in pageContent.fit.choices"
            :key="choice.need"
            :class="[
              'content-view__fit-choice',
              { 'content-view__fit-choice--solti': index === pageContent.fit.choices.length - 1 },
            ]"
          >
            <dt>{{ choice.need }}</dt>
            <dd>{{ choice.answer }}</dd>
          </div>
        </dl>
      </BaseContainer>
    </section>

    <section
      id="community"
      class="content-view__community"
      :aria-label="pageContent.community.label"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__community-inner">
        <aside
          class="content-view__community-commons"
          aria-labelledby="community-commons-title"
        >
          <BaseText
            as="p"
            size="caption"
            tone="subtle"
            class="content-view__community-commons-eyebrow"
          >
            {{ pageContent.community.commons.eyebrow }}
          </BaseText>
          <div class="content-view__community-commons-copy">
            <BaseHeading
              id="community-commons-title"
              as="h2"
              size="h3"
              class="content-view__community-commons-title"
            >
              {{ pageContent.community.commons.title }}
            </BaseHeading>
            <BaseText tone="muted" class="content-view__community-commons-body">
              {{ pageContent.community.commons.body }}
            </BaseText>
          </div>
          <BaseActionLink
            :href="siteContent.links.agentOverview"
            variant="secondary"
            external
          >
            {{ pageContent.community.commons.action }}
          </BaseActionLink>
        </aside>

        <aside
          class="content-view__community-open-source"
          aria-labelledby="community-open-source-title"
        >
          <div class="content-view__community-open-source-copy">
            <BaseText
              as="p"
              size="caption"
              tone="subtle"
              class="content-view__community-open-source-eyebrow"
            >
              {{ pageContent.community.openSource.eyebrow }}
            </BaseText>
            <BaseHeading
              id="community-open-source-title"
              as="h2"
              size="h1"
              class="content-view__community-open-source-title"
            >
              {{ pageContent.community.openSource.title }}
            </BaseHeading>
            <BaseText tone="muted" class="content-view__community-open-source-body">
              {{ pageContent.community.openSource.body }}
            </BaseText>
          </div>
          <div class="content-view__community-open-source-actions">
            <BaseActionLink :href="siteContent.links.github" variant="primary" external>
              {{ pageContent.community.openSource.action }}
            </BaseActionLink>
            <BaseActionLink
              :href="siteContent.links.contributing"
              variant="secondary"
              external
            >
              {{ pageContent.community.openSource.contributeAction }}
            </BaseActionLink>
          </div>
        </aside>
      </BaseContainer>
    </section>
  </BaseView>
</template>
