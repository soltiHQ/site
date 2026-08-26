<script setup lang="ts">
import ContentCommunity from '@/components/content/ContentCommunity.vue'
import ContentComposition from '@/components/content/ContentComposition.vue'
import ContentFit from '@/components/content/ContentFit.vue'
import ContentHero from '@/components/content/ContentHero.vue'
import ContentProof from '@/components/content/ContentProof.vue'
import ContentStack from '@/components/content/ContentStack.vue'
import ContentUseCases from '@/components/content/ContentUseCases.vue'
import BaseView from '@/components/view/BaseView.vue'
</script>

<template>
  <BaseView class="content-view">
    <ContentHero />
    <ContentStack />
    <ContentUseCases />
    <ContentComposition />
    <ContentProof />
    <ContentFit />
    <ContentCommunity />
  </BaseView>
</template>
