<script setup lang="ts">
import BaseContainer from '@/components/layout/BaseContainer.vue'

type SectionTone = 'canvas' | 'subtle' | 'inverse'

withDefaults(
  defineProps<{
    id?: string
    tone?: SectionTone
    contained?: boolean
    labelledBy?: string
  }>(),
  {
    id: undefined,
    tone: 'canvas',
    contained: true,
    labelledBy: undefined,
  },
)
</script>

<template>
  <section
    :id="id"
    :class="['o-section', `c-view-section--${tone}`]"
    :aria-labelledby="labelledBy"
  >
    <BaseContainer v-if="contained">
      <slot />
    </BaseContainer>
    <slot v-else />
  </section>
</template>
