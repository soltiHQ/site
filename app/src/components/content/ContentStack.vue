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

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import { useIntersectionReveal } from '@/composables/useIntersectionReveal'
import { siteContent } from '@/contents'

const pageContent = siteContent.pages.content
const stackMedia = siteContent.media.stack
const { target: stackOutro, visible: stackOutroVisible } = useIntersectionReveal({
  rootMargin: '0px 0px -12% 0px',
  threshold: 0.18,
})
const { target: stackList, visible: stackListVisible } = useIntersectionReveal({
  rootMargin: '0px 0px -12% 0px',
  threshold: 0.18,
})

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

function stackMediaUrl(path: string) {
  return `${path}?v=${stackMedia.version}`
}
</script>

<template>
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
</template>
