<script setup lang="ts">
import BaseHeading from '@/components/ui/BaseHeading.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseText from '@/components/ui/BaseText.vue'

withDefaults(
  defineProps<{
    title: string
    titleId?: string
    eyebrow?: string
    lede?: string
  }>(),
  {
    titleId: undefined,
    eyebrow: undefined,
    lede: undefined,
  },
)
</script>

<template>
  <header class="c-view-header">
    <div class="c-view-header__copy">
      <BaseLabel v-if="eyebrow">{{ eyebrow }}</BaseLabel>
      <BaseHeading :id="titleId" as="h1" size="display">{{ title }}</BaseHeading>
    </div>
    <BaseText v-if="lede" class="c-view-header__lede" tone="muted">{{ lede }}</BaseText>
  </header>
</template>
