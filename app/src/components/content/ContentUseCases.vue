<script setup lang="ts">
import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import { siteContent } from '@/contents'
import { siteLink } from './siteLink'

const pageContent = siteContent.pages.content
</script>

<template>
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
</template>
