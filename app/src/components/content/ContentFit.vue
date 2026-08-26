<script setup lang="ts">
import { computed } from 'vue'

import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import { useIntersectionReveal } from '@/composables/useIntersectionReveal'
import { siteContent } from '@/contents'

const pageContent = siteContent.pages.content
const { target: fitChoices, visible: fitChoicesVisible } = useIntersectionReveal({
  rootMargin: '0px 0px -12% 0px',
  threshold: 0,
})
const fitCards = computed(() =>
  pageContent.fit.choices.map((choice) => ({
    ...choice,
    items: choice.items.map((item) => {
      const at = item.lastIndexOf('→')
      return at === -1
        ? { need: item, answer: '' }
        : { need: item.slice(0, at).trim(), answer: item.slice(at + 1).trim() }
    }),
  })),
)
</script>

<template>
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

      <ul
        ref="fitChoices"
        class="content-view__fit-choices"
        role="list"
        :class="{ 'content-view__fit-choices--revealed': fitChoicesVisible }"
      >
        <li
          v-for="(choice, index) in fitCards"
          :key="choice.title"
          :class="[
            'content-view__fit-choice',
            'content-view__fit-choice--' + choice.tone,
          ]"
          :style="{ '--reveal-index': index }"
        >
          <BaseText
            as="p"
            size="caption"
            tone="subtle"
            class="content-view__fit-choice-label"
          >
            {{ choice.label }}
          </BaseText>
          <BaseHeading as="h3" size="h2" class="content-view__fit-choice-title">
            {{ choice.title }}
          </BaseHeading>
          <BaseText tone="muted" class="content-view__fit-choice-body">
            {{ choice.body }}
          </BaseText>
          <ul class="content-view__fit-choice-items" role="list">
            <li v-for="item in choice.items" :key="item.need">
              <span
                >{{ item.need }}<span
                  v-if="item.answer"
                  class="content-view__fit-choice-item-answer"
                >
                  → {{ item.answer }}</span
                ></span
              >
            </li>
          </ul>
          <BaseText
            as="p"
            size="small"
            tone="subtle"
            class="content-view__fit-choice-boundary"
          >
            {{ choice.boundary }}
          </BaseText>
        </li>
      </ul>
    </BaseContainer>
  </section>
</template>
