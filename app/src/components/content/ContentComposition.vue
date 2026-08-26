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
</template>
