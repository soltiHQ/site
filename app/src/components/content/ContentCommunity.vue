<script setup lang="ts">
import BaseContainer from '@/components/layout/BaseContainer.vue'
import BaseActionLink from '@/components/ui/BaseActionLink.vue'
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseText from '@/components/ui/BaseText.vue'
import { siteContent } from '@/contents'

const pageContent = siteContent.pages.content
</script>

<template>
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
</template>
