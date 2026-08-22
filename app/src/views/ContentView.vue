<script setup lang="ts">
import {
  Activity,
  FileJson2,
  Network,
  Play,
  Radar,
  RefreshCw,
  Route,
  TimerReset,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseActionLink from '@/components/ui/BaseActionLink.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import BaseView from '@/components/view/BaseView.vue'
import { siteContent } from '@/contents'

const heroVideo = ref<HTMLVideoElement | null>(null)
const traceOutput = ref<HTMLElement | null>(null)
// -1 renders the finished trace. Playback only arms itself when it can actually run, so
// no-JS, no IntersectionObserver, and reduced motion all get the complete output instead.
const traceRevealed = ref(-1)
// While the trace is mid-run, the manifest line that caused it and the connector between
// the panels both read as live, so the reader sees the cause next to the effect.
const traceRunning = ref(false)
// The cursor sits in the panel from the moment playback is armed, so an empty terminal
// reads as a waiting prompt rather than as a broken panel.
const traceAwaiting = computed(
  () => traceRevealed.value >= 0 && traceRevealed.value < pageContent.proof.trace.lines.length,
)
const stackOutro = ref<HTMLElement | null>(null)
const stackOutroVisible = ref(false)
const stackList = ref<HTMLElement | null>(null)
const stackListVisible = ref(false)
const fitChoices = ref<HTMLElement | null>(null)
const fitChoicesVisible = ref(false)
const pageContent = siteContent.pages.content
const heroMedia = siteContent.media.hero
const stackMedia = siteContent.media.stack
type SiteLinkKey = keyof typeof siteContent.links

const stackIcons = {
  resource: FileJson2,
  routing: Route,
  reconciliation: RefreshCw,
  lifecycle: TimerReset,
  execution: Play,
  api: Network,
  discovery: Radar,
  operations: Activity,
} as const

function stackIcon(key: string) {
  if (!(key in stackIcons)) {
    throw new Error(`Unknown stack icon: ${key}`)
  }

  return stackIcons[key as keyof typeof stackIcons]
}

function siteLink(key: string) {
  if (!(key in siteContent.links)) {
    throw new Error(`Unknown site link: ${key}`)
  }

  return siteContent.links[key as SiteLinkKey]
}

function heroMediaUrl(path: string) {
  return `${path}?v=${heroMedia.version}`
}

function stackMediaUrl(path: string) {
  return `${path}?v=${stackMedia.version}`
}

const heroPosterUrl = heroMediaUrl(heroMedia.poster)

let stackListObserver: IntersectionObserver | undefined
let fitObserver: IntersectionObserver | undefined
let traceObserver: IntersectionObserver | undefined
let traceTimeout: number | undefined
let videoObserver: IntersectionObserver | undefined
let stackObserver: IntersectionObserver | undefined
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

function playTrace() {
  const lines = pageContent.proof.trace.lines
  const first = lines[0]
  if (!first) return

  const step = () => {
    traceTimeout = undefined
    traceRevealed.value += 1
    const next = lines[traceRevealed.value]
    if (!next) {
      traceRunning.value = false
      return
    }
    traceTimeout = window.setTimeout(step, next.delay)
  }

  traceRunning.value = true
  traceTimeout = window.setTimeout(step, first.delay)
}

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const outro = stackOutro.value
  if (outro) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      stackOutroVisible.value = true
    } else {
      stackObserver = new IntersectionObserver(
        ([entry], observer) => {
          if (!entry?.isIntersecting) return

          stackOutroVisible.value = true
          observer.disconnect()
          stackObserver = undefined
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.18 },
      )

      stackObserver.observe(outro)
    }
  }

  const list = stackList.value
  if (list) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      stackListVisible.value = true
    } else {
      stackListObserver = new IntersectionObserver(
        ([entry], observer) => {
          if (!entry?.isIntersecting) return

          stackListVisible.value = true
          observer.disconnect()
          stackListObserver = undefined
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.18 },
      )

      stackListObserver.observe(list)
    }
  }

  const choices = fitChoices.value
  if (choices) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      fitChoicesVisible.value = true
    } else {
      fitObserver = new IntersectionObserver(
        ([entry], observer) => {
          if (!entry?.isIntersecting) return

          fitChoicesVisible.value = true
          observer.disconnect()
          fitObserver = undefined
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.18 },
      )

      fitObserver.observe(choices)
    }
  }

  const trace = traceOutput.value
  if (trace && !reducedMotion && 'IntersectionObserver' in window) {
    traceRevealed.value = 0
    traceObserver = new IntersectionObserver(
      ([entry], observer) => {
        if (!entry?.isIntersecting) return

        observer.disconnect()
        traceObserver = undefined
        playTrace()
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.4 },
    )

    traceObserver.observe(trace)
  }

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
  if (traceTimeout !== undefined) window.clearTimeout(traceTimeout)
  stackListObserver?.disconnect()
  fitObserver?.disconnect()
  traceObserver?.disconnect()
  videoObserver?.disconnect()
  stackObserver?.disconnect()
  document.removeEventListener('visibilitychange', updateHeroVideo)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <BaseView class="content-view">
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
            :data-src="heroMediaUrl(heroMedia.video.large.mp4)"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference) and (min-width: 1920px)"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.large.webm)"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference) and (min-width: 1920px)"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.standard.mp4)"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference) and (min-width: 768px)"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.standard.webm)"
            type="video/webm"
            media="(prefers-reduced-motion: no-preference) and (min-width: 768px)"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.mobile.mp4)"
            type="video/mp4"
            media="(prefers-reduced-motion: no-preference)"
          />
          <source
            :data-src="heroMediaUrl(heroMedia.video.mobile.webm)"
            type="video/webm"
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

    <section
      id="stack"
      class="content-view__stack"
      aria-labelledby="stack-title"
      data-chrome-theme="light"
    >
      <BaseContainer class="content-view__stack-inner">
        <header class="content-view__stack-intro">
          <div class="content-view__stack-heading">
            <BaseText
              as="p"
              size="caption"
              tone="subtle"
              class="content-view__stack-eyebrow"
            >
              {{ pageContent.stack.eyebrow }}
            </BaseText>
            <BaseHeading
              id="stack-title"
              as="h2"
              size="h1"
              class="content-view__stack-title"
            >
              {{ pageContent.stack.title }}
            </BaseHeading>
          </div>
          <BaseText tone="muted" class="content-view__stack-lede">
            {{ pageContent.stack.lede }}
          </BaseText>
        </header>

        <BaseText
          as="p"
          size="caption"
          tone="subtle"
          class="content-view__stack-axis"
        >
          {{ pageContent.stack.axis }}
        </BaseText>

        <ul
          ref="stackList"
          class="content-view__stack-list"
          :class="{ 'content-view__stack-list--revealed': stackListVisible }"
        >
          <li
            v-for="(item, index) in pageContent.stack.items"
            :key="item.scope"
            class="content-view__stack-item"
            :style="{ '--reveal-index': index }"
          >
            <div class="content-view__stack-item-meta" aria-hidden="true">
              <component
                :is="stackIcon(item.icon)"
                class="content-view__stack-icon"
                :size="28"
                :stroke-width="1.5"
                :absolute-stroke-width="true"
              />
              <span class="content-view__stack-index">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
            </div>
            <BaseHeading as="h3" size="h2" class="content-view__stack-item-title">
              {{ item.scope }}
            </BaseHeading>
            <BaseText tone="muted" class="content-view__stack-item-body">
              {{ item.body }}
            </BaseText>
          </li>
        </ul>
        <div
          ref="stackOutro"
          class="content-view__stack-outro"
          :class="{ 'content-view__stack-outro--visible': stackOutroVisible }"
        >
          <p class="content-view__stack-principle">
            {{ pageContent.stack.principle }}
          </p>
          <div class="content-view__stack-artwork" aria-hidden="true">
            <img
              class="content-view__stack-artwork-image"
              :src="stackMediaUrl(stackMedia.hands)"
              alt=""
              width="1200"
              height="800"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
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
      id="components"
      class="content-view__composition"
      aria-labelledby="components-title"
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
            id="components-title"
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
              :class="[
                'content-view__proof-code-line',
                { 'is-live': traceRunning && line.includes(pageContent.proof.transition) },
              ]"
            >{{ line || ' ' }}</span></code></pre>
          </article>

          <div
            :class="['content-view__proof-connector', { 'is-live': traceRunning }]"
            aria-hidden="true"
          >
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
              ref="traceOutput"
              class="content-view__proof-code content-view__proof-code--trace"
              tabindex="0"
            ><code><span class="content-view__proof-trace-command">{{ pageContent.proof.trace.command }}</span><span
              v-for="(line, index) in pageContent.proof.trace.lines"
              :key="line.text"
              :class="[
                'content-view__proof-code-line',
                'content-view__proof-code-line--' + line.tone,
                { 'is-pending': traceRevealed >= 0 && index >= traceRevealed },
              ]"
            >{{ line.text }}</span><span
              v-if="traceAwaiting"
              class="content-view__proof-trace-cursor"
              aria-hidden="true"
            ></span></code></pre>
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

        <dl
          ref="fitChoices"
          class="content-view__fit-choices"
          :class="{ 'content-view__fit-choices--revealed': fitChoicesVisible }"
        >
          <div
            v-for="(choice, index) in pageContent.fit.choices"
            :key="choice.need"
            :class="[
              'content-view__fit-choice',
              { 'content-view__fit-choice--solti': choice.featured },
            ]"
            :style="{ '--reveal-index': choice.featured ? index + 1 : index }"
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
        <section
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
        </section>

        <section
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
        </section>
      </BaseContainer>
    </section>
  </BaseView>
</template>
