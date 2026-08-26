<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseActionLink from '@/components/ui/BaseActionLink.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import { siteContent } from '@/contents'
import { siteLink } from './siteLink'

const pageContent = siteContent.pages.content
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

let traceObserver: IntersectionObserver | undefined
let traceTimeout: number | undefined

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
})

onBeforeUnmount(() => {
  if (traceTimeout !== undefined) window.clearTimeout(traceTimeout)
  traceObserver?.disconnect()
})
</script>

<template>
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
</template>
